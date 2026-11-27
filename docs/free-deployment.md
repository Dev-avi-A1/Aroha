# AROHA Life OS — Free Self-Hosting Deployment Guide ($0/month)

This guide explains how to deploy **AROHA Life OS** (`server.ts` + Vite React SPA + PostgreSQL + Firebase Auth + Gemini AI) to production at **$0/month**, covering both **Google Cloud Run (Always-Free Tier)** and a **no-credit-card alternative** (Koyeb / Render).

---

## 1. Cost Breakdown & Why Not Cloud SQL

| Layer | Service | Free Allowance | Notes |
| :--- | :--- | :--- | :--- |
| **Compute (Web + API)** | **Google Cloud Run** | 2M requests/mo, 360,000 GB-s memory, 180,000 vCPU-s, 1 GB egress/mo | Must use a **Tier-1 region** and `--min-instances 0`. |
| **Database** | **Neon PostgreSQL** | 0.5 GB storage, 100 CU-hours/mo, auto-scales to zero | **Do NOT use Cloud SQL** for free hosting — Cloud SQL has no Always-Free tier (~$7–$15+/mo). |
| **Authentication** | **Firebase Auth** (Spark Plan) | 50,000 MAUs (Email/Password + Google OAuth) | Token verification in `src/lib/firebase-admin.ts` only requires `projectId`. |
| **AI Coach** | **Google Gemini API** | Free tier available via Google AI Studio | Set `GEMINI_API_KEY` on the server; never expose it in client code. |
| **Container Registry** | **Artifact Registry** | 0.5 GB storage/month | Prune old image digests after redeploys to stay under 0.5 GB. |

---

## 2. Prerequisites

- **Node.js 22.18+ or 24+** (required for native `.ts` imports in `node server.ts`, or use `npx tsx server.ts` on Node 20/22)
- **Git** and the AROHA repository locally
- **Free Neon account** ([neon.tech](https://neon.tech))
- **Google Cloud CLI (`gcloud`)** installed and authenticated (if deploying to Cloud Run)
- **Gemini API Key** from Google AI Studio (`GEMINI_API_KEY`)
- Access to your **Firebase Console** project matching `firebase-applet-config.json`

---

## 3. Step 1 — Create a Free Neon PostgreSQL Database

1. Sign in to **Neon** and create a new project.
2. Pick a region **physically close** to your Cloud Run region to minimize latency:
   - If deploying Cloud Run in `europe-west1` (Belgium), choose **EU (Frankfurt)** in Neon.
   - If deploying Cloud Run in `us-central1` (Iowa), choose **US East (Ohio)** or **US East (N. Virginia)** in Neon.
3. Copy your **Connection String** (`DATABASE_URL`), which looks like:
   ```text
   postgresql://<user>:<password>@<endpoint-host>.neon.tech/neondb?sslmode=require
   ```

---

## 4. Step 2 — Update DB Config to Support `DATABASE_URL`

By default, `src/db/index.ts` and `src/db/drizzle.config.ts` read Cloud SQL socket variables (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`). To run against Neon (while keeping Cloud SQL compatibility), update both files as shown below.

### 4.1 Update `src/db/index.ts`

Modify `createPool()` so it accepts `process.env.DATABASE_URL` when provided:

```ts
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      min: 0,
      max: 10,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 20000,
      keepAlive: true,
      allowExitOnIdle: true,
    })
  : new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      min: 0,
      max: 10,
      idleTimeoutMillis: 5000,
      maxLifetimeSeconds: 300,
      connectionTimeoutMillis: 20000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 5000,
      allowExitOnIdle: true,
    });
```

### 4.2 Update `src/db/drizzle.config.ts`

Allow `drizzle-kit` to use `DATABASE_URL` when present:

```ts
import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.SQL_HOST!,
        user: process.env.SQL_ADMIN_USER!,
        password: process.env.SQL_ADMIN_PASSWORD!,
        database: process.env.SQL_DB_NAME!,
        ssl: false,
      },
  verbose: true,
});
```

### 4.3 Push the Schema to Neon

Run this once from the project root to create all 14 tables (`users`, `schedule_blocks`, `schedule_templates`, `habits`, `habit_checkins`, `focus_sessions`, `health_logs`, `journal_entries`, `goals`, `learning_logs`, `flashcards`, `reminders`, `user_achievements`, `coach_messages`):

```bash
DATABASE_URL="postgresql://<user>:<password>@<host>.neon.tech/neondb?sslmode=require" \
  npx drizzle-kit push --config=src/db/drizzle.config.ts
```

---

## 5. Step 3 — Add Production `Dockerfile` and `.dockerignore`

`server.ts` automatically binds `0.0.0.0`, reads `process.env.PORT` (which Cloud Run sets to `8080`), serves `public/`, and serves the compiled Vite SPA from `dist/` when `NODE_ENV=production`.

### 5.1 Create `Dockerfile` in the project root

```dockerfile
# Node 24 natively executes TypeScript (.ts) files imported by server.ts
FROM node:24-slim AS base
WORKDIR /app

# Install all dependencies (including vite & typescript for building dist/)
COPY package.json bun.lock* package-lock.json* ./
RUN npm install

# Copy application source
COPY . .

# Build Vite frontend + PWA service worker into dist/ and typecheck
RUN npm run build

# Optional: prune devDependencies if you switch CMD to node server.ts
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.ts"]
```

> **Note:** If you use `node:22-slim` (older than `22.18`) instead of `node:24-slim`, change the final line to `CMD ["npx", "tsx", "server.ts"]` because `server.ts` uses `.ts` file extension imports.

### 5.2 Create `.dockerignore` in the project root

```dockerignore
node_modules
dist
dev-dist
.git
.env
.env.*
!.env.example
.aistudio
*.log
```

---

## 6. Step 4 — Deploy to Google Cloud Run (Free Tier)

### 6.1 Initialize `gcloud` and enable required APIs

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### 6.2 Deploy to a Tier-1 Always-Free Region

Choose a Tier-1 region such as `us-central1`, `us-east1`, `us-west1`, `europe-west1`, or `asia-east1`:

```bash
gcloud run deploy aroha \
  --source . \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 80 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "DATABASE_URL=postgresql://<user>:<password>@<host>.neon.tech/neondb?sslmode=require" \
  --set-env-vars "GEMINI_API_KEY=your_gemini_api_key_here"
```

When finished, Cloud Run outputs your live HTTPS service URL, for example:
`https://aroha-xxxxxxxxxx-ew.a.run.app`

> **Security Tip:** For stronger secret hygiene, you can store `DATABASE_URL` and `GEMINI_API_KEY` in **GCP Secret Manager** (6 active secret versions are free/month) and pass `--set-secrets="DATABASE_URL=aroha-db-url:latest,GEMINI_API_KEY=aroha-gemini-key:latest"`.

### 6.3 Prevent Surprise Cloud Costs

1. **Set a $1 Budget Alert:** In Google Cloud Console → **Billing → Budgets & alerts**, create a monthly budget of `$1` with email alerts at 50%, 90%, and 100%.
2. **Prune Artifact Registry after redeploys:** Artifact Registry only gives **0.5 GB free/month**, and each `gcloud run deploy --source .` creates a new image layer. List and delete old images periodically:
   ```bash
   gcloud artifacts docker images list \
     europe-west1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/cloud-run-source-deploy/aroha

   # Delete older unused digests to stay under 0.5 GB
   gcloud artifacts docker images delete \
     europe-west1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/cloud-run-source-deploy/aroha@sha256:OLD_DIGEST \
     --quiet --delete-tags
   ```

---

## 7. Step 5 — Configure Firebase Auth for Your Live URL

1. Open **Firebase Console** for the project in `firebase-applet-config.json`.
2. Go to **Authentication → Settings → Authorized domains**.
3. Click **Add domain** and add your Cloud Run hostname (e.g., `aroha-xxxxxxxxxx-ew.a.run.app`), plus any custom domain you connect later.
4. Confirm **Email/Password** and **Google** sign-in providers are enabled under **Authentication → Sign-in method**.

> Note: `src/lib/firebase-admin.ts` initializes `firebase-admin` using only `projectId` from `firebase-applet-config.json` to verify JWT ID tokens via Google's public certificates, so no service-account JSON key file is needed on Cloud Run.

---

## 8. Step 6 — Verify the Live Deployment

1. **Health check:**
   ```bash
   curl https://YOUR-SERVICE-URL.a.run.app/api/health-check
   # Expected: {"ok":true,"service":"aroha-life-os"}
   ```
2. **SEO & PWA assets:**
   - Visit `/robots.txt` and `/sitemap.xml`.
   - Open the live HTTPS URL in Chrome on desktop or Android and verify the **Install AROHA** prompt / app icon (`public/app-icon-512.png`) works cleanly.
3. **Auth & Database smoke test:**
   - Sign in with a fresh test account and verify Level `0` initialization, creating a habit, and deploying a multi-date schedule template.

---

## 9. Alternative: No-Credit-Card Free Hosting (Koyeb / Render + Neon)

Google Cloud requires a billing card on file even for the Always-Free Tier. If you do not want to attach a credit card:

1. Push your repo (with the `DATABASE_URL` update + `Dockerfile` above) to a private or public **GitHub** repository (ensure `.env` is never committed).
2. Create a free web service on **Koyeb** (1 free Eco micro instance, no card required) or **Render** (free Web Service, sleeps after 15 min idle):
   - **Deployment type:** Docker (uses your `Dockerfile`)
   - **Port:** `8080`
   - **Environment variables:**
     - `NODE_ENV=production`
     - `PORT=8080`
     - `DATABASE_URL=postgresql://...` (from Neon)
     - `GEMINI_API_KEY=...`
3. Add the generated `*.koyeb.app` or `*.onrender.com` hostname to **Firebase Console → Authentication → Authorized domains**.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| **`auth/unauthorized-domain` on Google Login** | Live domain not allowlisted in Firebase | Add your `*.run.app` or custom domain in Firebase Auth → **Authorized domains**. |
| **`503 Workspace database is temporarily unavailable`** | Neon cold-start or missing SSL | Verify `DATABASE_URL` includes `?sslmode=require` and `ssl: { rejectUnauthorized: false }` in `src/db/index.ts`. |
| **Container fails on startup with `.ts` syntax/import error** | Node version < 22.18 running `node server.ts` | Use `FROM node:24-slim` or change `CMD` to `["npx", "tsx", "server.ts"]`. |
| **Small unexpected GCP charge after several deploys** | Artifact Registry image storage > 0.5 GB | Delete old image digests from `cloud-run-source-deploy` in Artifact Registry. |
| **AI Coach returns error** | Missing or restricted `GEMINI_API_KEY` | Check `GEMINI_API_KEY` env var on Cloud Run and ensure Gemini API quota/billing is active in Google AI Studio. |
