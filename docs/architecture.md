# AROHA Life OS — Architecture & File Reference

**AROHA** is a full-stack Personal Evolution System combining 24-hour time blocking, habit streak tracking, deep focus timers, biological health logging, journaling, active-recall learning, gamified XP/ranks, and an AI tactical discipline coach.

---

## 1. Tech Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, Radix UI primitives, React Router v7, Sonner toasts, Lucide icons, PWA (`vite-plugin-pwa`)
- **Backend**: Node.js 22+, Express, Zod validation
- **Database**: PostgreSQL (Cloud SQL) with Drizzle ORM
- **Authentication**: Firebase Auth (Email/Password & Google Sign-In) + Firebase Admin SDK token verification
- **AI Coach**: Google Gemini (`@google/genai`) invoked strictly server-side

---

## 2. Project File Tree

```text
.
├── .env.example
├── README.md
├── bun.lock
├── firebase-applet-config.json
├── index.html
├── metadata.json
├── package.json
├── server.ts
├── tsconfig.json
├── vite.config.ts
├── docs/
│   └── architecture.md              # This documentation file
├── dev-dist/                        # Auto-generated dev PWA service worker files
│   ├── sw.js
│   └── workbox-afac4cd2.js
├── dist/                            # Production build output directory
│   └── favicon.ico
├── public/                          # Static assets served at /
│   ├── app-icon-192.png
│   ├── app-icon-512.png
│   ├── apple-touch-icon.png
│   ├── favicon.ico
│   ├── favicon.png
│   ├── notifications-sw.js
│   ├── og-aroha.jpg
│   └── robots.txt
└── src/
    ├── App.tsx
    ├── index.css
    ├── main.tsx
    ├── vite-env.d.ts
    ├── components/
    │   ├── aroha/                   # Domain-specific feature components
    │   │   ├── app-shell.tsx
    │   │   ├── auth-gate.tsx
    │   │   ├── auth-security-shield.tsx
    │   │   ├── custom-templates.tsx
    │   │   ├── notification-scheduler.tsx
    │   │   ├── primitives.tsx
    │   │   ├── pwa-controls.tsx
    │   │   └── today-loop.tsx
    │   └── ui/                      # Reusable Radix UI components
    │       ├── accordion.tsx
    │       ├── alert-dialog.tsx
    │       ├── avatar.tsx
    │       ├── button.tsx
    │       ├── checkbox.tsx
    │       ├── command.tsx
    │       ├── dialog.tsx
    │       ├── input.tsx
    │       ├── select.tsx
    │       ├── sheet.tsx
    │       ├── skeleton.tsx
    │       ├── slider.tsx
    │       ├── switch.tsx
    │       ├── tabs.tsx
    │       ├── textarea.tsx
    │       └── tooltip.tsx
    ├── context/
    │   └── WorkspaceContext.tsx
    ├── db/                          # PostgreSQL & Drizzle ORM layer
    │   ├── drizzle.config.ts
    │   ├── index.ts
    │   ├── schema.ts
    │   ├── users.ts
    │   └── workspace.ts
    ├── lib/                         # Shared utilities, security guards, AI & Firebase
    │   ├── audio.ts
    │   ├── bot-guard.ts
    │   ├── email-guard.ts
    │   ├── firebase-admin.ts
    │   ├── firebase.ts
    │   ├── gemini.ts
    │   ├── presets.ts
    │   ├── quotes.ts
    │   ├── seo.ts
    │   ├── utils.ts
    │   └── xp.ts
    ├── middleware/
    │   └── auth.ts
    └── pages/                       # Route views
        ├── AchievementsPage.tsx
        ├── AnalyticsPage.tsx
        ├── AuthPage.tsx
        ├── CoachPage.tsx
        ├── FeaturesPage.tsx
        ├── FocusPage.tsx
        ├── GoalsPage.tsx
        ├── HabitsPage.tsx
        ├── HealthPage.tsx
        ├── HomePage.tsx
        ├── JournalPage.tsx
        ├── LandingPage.tsx
        ├── LearnPage.tsx
        ├── LevelPage.tsx
        ├── ProfilePage.tsx
        ├── RemindersPage.tsx
        ├── SchedulePage.tsx
        ├── SettingsPage.tsx
        └── SyncPage.tsx
```

---

## 3. How the Files Interconnect

```text
Browser Request
  │
  ├──► index.html ──► src/main.tsx (registers PWA Service Worker)
  │                     │
  │                     ▼
  │                 src/App.tsx (BrowserRouter + global Toaster + TooltipProvider)
  │                     │
  │                     ├──► Public Routes (/ , /aroha , /features , /login , /signup)
  │                     │      └── AuthPage uses AuthSecurityShield
  │                     │            └──► /api/auth/challenge & /api/auth/security-check
  │                     │
  │                     └──► Protected Routes (/home , /schedule , /habits , /coach , etc.)
  │                            └── Wrapped by AppShell ──► AuthGate
  │                                  │
  │                                  ▼
  │                          WorkspaceContext.tsx (global state + UID-scoped offline cache)
  │                            ├── Gets Firebase ID token from src/lib/firebase.ts
  │                            └── Sends Bearer-authenticated requests to /api/*
  │
  ▼
Express Server (server.ts — serves Vite middleware in dev, dist/ in production)
  ├── Global Middleware: HTTP security headers, JSON size limit (2MB), trust proxy
  ├── Auth Shield: bot-guard.ts + email-guard.ts (challenge tokens, honeypot, rate limits, MX checks)
  ├── Auth Middleware (src/middleware/auth.ts):
  │     ├── Verifies Firebase token via firebase-admin.ts
  │     ├── Rejects disposable email domains (403)
  │     └── Calls getOrCreateUser() (src/db/users.ts) -> seeds Monk Mode on first login
  ├── Database Layer (src/db/):
  │     ├── index.ts (PostgreSQL Pool with transient disconnect retry + Drizzle ORM)
  │     ├── schema.ts (14 user-scoped relational tables)
  │     └── workspace.ts (computes streaks, Discipline Score, XP, badges, heatmap, daily quote)
  └── AI Coach (src/lib/gemini.ts):
        └── Uses server-side GEMINI_API_KEY + live telemetry to generate coach replies
```

---

## 4. Detailed File Reference

### Root Configuration & Entry Files

| File | Description & Features |
|---|---|
| `package.json` | Project manifest declaring runtime/build dependencies and scripts (`dev`, `build`, `start`, `lint`). |
| `.env.example` | Template documenting required secrets (`GEMINI_API_KEY`, `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`). |
| `metadata.json` | App title, description, and platform capability declarations. |
| `firebase-applet-config.json` | Public Firebase project settings read by `firebase.ts` and `firebase-admin.ts`. |
| `tsconfig.json` | TypeScript compiler config (`strict`, `@/*` alias mapped to `src/*`). |
| `vite.config.ts` | Configures React, Tailwind CSS v4, `@` alias, and `VitePWA` (`manifest.webmanifest`, Workbox caching for fonts only, `/api/` excluded from navigation fallback, and imports `/notifications-sw.js`). |
| `index.html` | Root HTML document with SEO/OpenGraph/Twitter/JSON-LD metadata, Google Fonts (`Inter`, `Poppins`, `JetBrains Mono`), and `#root` mount point. |
| `server.ts` | Unified Express backend: security headers, `/robots.txt`, `/sitemap.xml`, anti-bot auth challenge endpoints, Zod-validated `/api/*` CRUD endpoints, AI coach proxy, JSON backup export/import, and Vite/static SPA serving. |
| `README.md` | Short project summary file. |
| `bun.lock` | Deterministic dependency lockfile. |

### Static, PWA & Build Output Directories

| Path | Description & Features |
|---|---|
| `public/` | Static assets served from `/`: PWA & touch icons (`app-icon-192.png`, `app-icon-512.png`, `apple-touch-icon.png`, `favicon.png`, `favicon.ico`), OpenGraph banner (`og-aroha.jpg`), `robots.txt`, and `notifications-sw.js` (handles OS notification clicks and enforces same-origin relative route navigation). |
| `dev-dist/` | Auto-generated Workbox development service worker (`sw.js`, `workbox-afac4cd2.js`) created by `vite-plugin-pwa` when `devOptions.enabled` is active. |
| `dist/` | Production client build output directory created by `vite build`. |

### `src/` Core Entry & Global Context

| File | Description & Features |
|---|---|
| `src/main.tsx` | Registers the PWA service worker (`registerSW({ immediate: true })`) and renders `<App />`. |
| `src/App.tsx` | Configures React Router routes (public landing/auth pages and 15+ Life OS workspace pages), `<TooltipProvider>`, `<WorkspaceProvider>`, `<OfflineIndicator />`, and `<Toaster />`. |
| `src/index.css` | Tailwind v4 `@import`, dark navy/charcoal/violet CSS custom properties, typography rules, and shared surface utilities (`.card-surface`, `.num`, `.glow-primary`). |
| `src/vite-env.d.ts` | Vite and `virtual:pwa-register` ambient TypeScript declarations. |
| `src/context/WorkspaceContext.tsx` | Central state manager: tracks Firebase auth state, obtains ID tokens, wraps `apiFetch`, exposes all workspace mutations, validates emails on auth flows, and maintains a UID-scoped offline `localStorage` cache (`aroha_offline_snapshot_v1`) cleared on sign-out. |

### `src/middleware/` & `src/db/` (Backend Auth & Persistence)

| File | Description & Features |
|---|---|
| `src/middleware/auth.ts` | `requireAuth` verifies `Authorization: Bearer <token>` via Firebase Admin, blocks disposable emails with HTTP `403`, initializes/loads the PostgreSQL user via `getOrCreateUser()`, and attaches `req.dbUserId`. |
| `src/db/index.ts` | Creates and caches the `pg` connection pool with keep-alive, short idle timeouts for Cloud SQL scale-to-zero, transient disconnect suppression, and automatic single retry on dropped sockets. |
| `src/db/drizzle.config.ts` | Drizzle Kit configuration pointing to `src/db/schema.ts` and PostgreSQL environment variables. |
| `src/db/schema.ts` | Defines 14 PostgreSQL tables (`users`, `scheduleBlocks`, `scheduleTemplates`, `habits`, `habitCheckins`, `focusSessions`, `healthLogs`, `journalEntries`, `goals`, `learningLogs`, `flashcards`, `reminders`, `userAchievements`, `coachMessages`) with cascading foreign keys and unique constraints. |
| `src/db/users.ts` | `getOrCreateUser()` provisions new user accounts and seeds the initial "Monk Mode" baseline (4 schedule presets, today's blocks, 5 habits, starter health/focus/journal/goal/learning/flashcard/reminder entries, and coach welcome message). |
| `src/db/workspace.ts` | `getFullWorkspaceState()` loads all user records in parallel, recomputes habit streaks (`recomputeHabitStreakInDb`), calculates Discipline Score, XP/level/rank, auto-unlocks milestone badges, builds 7/30/91-day analytics arrays, and selects the user's daily Sanskrit quote. |

### `src/lib/` (Shared Business Logic, Security & Integrations)

| File | Description & Features |
|---|---|
| `src/lib/firebase.ts` | Browser Firebase app initialization (`auth`, `googleAuthProvider`). |
| `src/lib/firebase-admin.ts` | Server Firebase Admin initialization (`adminAuth`). |
| `src/lib/gemini.ts` | Server-only Gemini coach wrapper (`generateCoachReply`) that passes live operator metrics (Discipline Score, blocks, habits, focus minutes, water/sleep, mood, active goals) as system context to `gemini-4-hydrogen`. |
| `src/lib/bot-guard.ts` | Server-side anti-automation utilities: proxy-verified `getClientIp`, script/bot User-Agent detection, sliding-window rate limits & penalty lockouts, HMAC-SHA256 signed math/timing/honeypot challenges (`createSecurityChallenge` / `verifySecurityChallenge`), and DNS MX domain checks. |
| `src/lib/email-guard.ts` | Email normalization, syntax validation, trusted-provider matching, and disposable/temporary domain blocking used across both client and server. |
| `src/lib/xp.ts` | Computes XP breakdowns across 9 activity sources, progressive level curves, 6-tier rank ladder (`Novice` to `Sovereign`), Discipline Score (`0–100`), and badge metadata. |
| `src/lib/quotes.ts` | Collection of 74 Sanatan Dharma Sanskrit verses (Devanagari, transliteration, English translation, source) with deterministic per-user, per-day selection (`quoteForDate`). |
| `src/lib/presets.ts` | Four built-in daily routine presets (*Monk Mode*, *Corporate Execution*, *Creative Deep Work*, *Weekend Recovery*) plus timezone-aware date/time formatting helpers. |
| `src/lib/audio.ts` | Synthesized Web Audio tactical chimes (`start`, `pause`, `complete`, `alert`), `navigator.vibrate` haptics, and Web Speech API voice alerts. |
| `src/lib/seo.ts` | `usePageSEO()` React hook dynamically updating `<title>`, meta description, canonical URL, OpenGraph, and Twitter tags. |
| `src/lib/utils.ts` | `cn()` Tailwind class utility and timezone clock helpers. |

### `src/components/` (UI Primitives & AROHA Feature Components)

- **`src/components/ui/` (16 files)**: Radix-based accessible dark UI primitives (`accordion`, `alert-dialog`, `avatar`, `button`, `checkbox`, `command`, `dialog`, `input`, `select`, `sheet`, `skeleton`, `slider`, `switch`, `tabs`, `textarea`, `tooltip`).
- **`src/components/aroha/` (8 files)**:
  - `app-shell.tsx`: Desktop fixed sidebar, mobile sheet drawer + bottom navigation bar, Focus Mode toggle, and `Cmd/Ctrl+K` command palette.
  - `auth-gate.tsx`: Guards authenticated pages with skeleton loaders, login/signup gate, and retry screen on sync failure.
  - `auth-security-shield.tsx`: Renders the interactive server-signed human verification challenge and hidden honeypot input on auth forms.
  - `today-loop.tsx`: Live Command Center card tracking the active and next time blocks with one-click completion.
  - `custom-templates.tsx`: Sheet/dialog UI for creating, editing, duplicating, and deleting custom schedule templates.
  - `notification-scheduler.tsx`: Client-side scheduler checking upcoming blocks and reminders every minute to trigger chimes, speech, toasts, and Service Worker notifications.
  - `pwa-controls.tsx`: `usePWAInstall` hook, `PWAInstallButton` (Android/iOS install guidance), and `OfflineIndicator` banner.
  - `primitives.tsx`: Domain UI components including the animated SVG `ScoreRing`, metric cards, and progress meters.

### `src/pages/` (Route Views)

| File | Route(s) | Features |
|---|---|---|
| `LandingPage.tsx` | `/`, `/aroha` | Public marketing overview and call-to-action entry points. |
| `FeaturesPage.tsx` | `/features` | Detailed showcase of scheduling, habits, health, AI coaching, and analytics capabilities. |
| `AuthPage.tsx` | `/login`, `/signup` | Email/password sign-in, sign-up, password reset, Google OAuth, disposable email validation, and anti-bot challenge verification. |
| `HomePage.tsx` | `/home` | Command Center: per-user daily Sanskrit quote, Discipline Score ring, `TodayLoop`, XP progress bar, quick habit toggles, and hydration controls. |
| `SchedulePage.tsx` | `/schedule`, `/time-blocking-app` | 24-hour time-block manager, block CRUD, routine preset application, and custom template builder. |
| `HabitsPage.tsx` | `/habits`, `/habit-tracker` | Habit management, daily check-in toggles, streak tracking, and 30-day completion matrix. |
| `FocusPage.tsx` | `/focus` | Pomodoro (`25/5`, `50/10`) and stopwatch timer with audio cues, haptics, and `+10 XP` logging. |
| `HealthPage.tsx` | `/health` | Hydration (`ml`), sleep duration/quality, and physical training tracker. |
| `JournalPage.tsx` | `/journal` | Daily reflection editor with mood tags (`Focused`, `Calm`, `Tired`, `Driven`) awarding `+15 XP`. |
| `CoachPage.tsx` | `/coach` | Interactive chat UI connected to the server-side Gemini AI tactical coach (`/api/coach/chat`). |
| `AnalyticsPage.tsx` | `/analytics` | 91-day consistency heatmap, 7/30-day trend bars, focus totals, and high-priority execution ratio. |
| `GoalsPage.tsx` | `/goals` | Categorized goals with interactive milestone checklists (`+50 XP` when completed). |
| `LearnPage.tsx` | `/learn` | Reading/course/lecture logs and flip-card active-recall flashcard decks. |
| `LevelPage.tsx` | `/level` | XP source breakdown and 6-tier rank progression ladder. |
| `AchievementsPage.tsx` | `/achievements` | Progress tracking and unlock state for 6 discipline badges (`+75 XP` bonus each). |
| `RemindersPage.tsx` | `/reminders`, `/notifications` | Custom weekday recurring alerts, snooze actions, and voice alert toggles. |
| `SyncPage.tsx` | `/sync` | JSON backup export/import, offline sync status, and account workspace reset to Monk Mode. |
| `ProfilePage.tsx` | `/profile`, `/profile/edit` | Operator profile summary, avatar/handle/bio editor, and sign-out action. |
| `SettingsPage.tsx` | `/settings` | Timezone, Focus Mode, notification lead time, sound volume, haptics, and voice preferences. |

---

## 5. Key API Endpoints (`server.ts`)

- **Public / System**: `GET /api/health-check`, `GET /robots.txt`, `GET /sitemap.xml`
- **Auth Security**: `GET /api/auth/challenge`, `POST /api/auth/security-check`, `POST /api/auth/login-telemetry`
- **Workspace & Profile** *(Bearer Auth)*: `GET /api/workspace`, `PATCH /api/profile`
- **Execution Modules** *(Bearer Auth)*:
  - `/api/schedule/blocks` (`POST`, `PATCH /:id`, `DELETE /:id`), `/api/schedule/apply-template` (`POST`), `/api/templates` (`POST`, `PATCH /:id`, `DELETE /:id`)
  - `/api/habits` (`POST`, `PATCH /:id`, `DELETE /:id`, `POST /:id/checkin`)
  - `/api/focus/sessions` (`POST`), `/api/health` (`POST`), `/api/journal` (`POST`, `PATCH /:id`, `DELETE /:id`)
  - `/api/goals` (`POST`, `PATCH /:id`, `DELETE /:id`), `/api/learn/logs` (`POST`, `PATCH /:id`, `DELETE /:id`), `/api/learn/flashcards` (`POST`, `PATCH /:id`, `DELETE /:id`)
  - `/api/reminders` (`POST`, `PATCH /:id`, `DELETE /:id`)
- **AI Coach & Sync** *(Bearer Auth)*: `POST /api/coach/chat`, `DELETE /api/coach/history`, `GET /api/sync/export`, `POST /api/sync/import`, `POST /api/account/reset`

---

## 6. Scripts & Runtime Notes

- **Development**: `npm run dev` (starts `server.ts` via `tsx watch` on port `3000` with Vite middleware)
- **Typecheck / Lint**: `npm run lint` (`tsc --noEmit`)
- **Production Build**: `npm run build` (`vite build && tsc --noEmit`)
- **Production Start**: `NODE_ENV=production npm start` (`node server.ts` on Node 22+)
- **Android Packaging**: Host the production server on HTTPS, add the production domain in Firebase Authorized Domains, and package via PWABuilder / Bubblewrap TWA (`manifest.webmanifest` + `public/.well-known/assetlinks.json`).
