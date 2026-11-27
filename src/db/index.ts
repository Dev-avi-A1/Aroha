import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

function isTransientDisconnect(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { message?: string; code?: string; cause?: unknown };
  const msg = e.message || '';
  const code = e.code || '';
  if (
    msg.includes('Connection terminated unexpectedly') ||
    msg.includes('Connection terminated') ||
    msg.includes('Client has encountered a connection error') ||
    code === 'ENOENT' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === 'ETIMEDOUT' ||
    code === '57P01'
  ) {
    return true;
  }
  if (e.cause && e.cause !== err) {
    return isTransientDisconnect(e.cause);
  }
  return false;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const pool = new Pool({
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

    // pg-pool automatically evicts broken idle clients; suppress noisy stderr stack dumps for expected scale-to-zero disconnects
    pool.on('error', (err) => {
      if (isTransientDisconnect(err)) {
        return;
      }
      console.error('Unexpected SQL pool error:', err);
    });

    // Bounded exponential backoff with jitter (max 3 attempts) for transient proxy startup / scale-to-zero drops
    const rawQuery = pool.query.bind(pool) as (...args: unknown[]) => unknown;
    pool.query = ((...args: unknown[]) => {
      const hasCallback = typeof args[args.length - 1] === 'function';
      if (hasCallback) {
        return rawQuery(...args);
      }
      const runWithRetry = async (attempt: number): Promise<unknown> => {
        try {
          return await Promise.resolve(rawQuery(...args));
        } catch (err) {
          if (attempt < 3 && isTransientDisconnect(err)) {
            const delayMs = 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 150);
            await new Promise((r) => setTimeout(r, delayMs));
            return runWithRetry(attempt + 1);
          }
          throw err;
        }
      };
      return runWithRetry(0);
    }) as Pool['query'];

    global._postgresPool = pool;
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
