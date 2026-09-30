import { Prisma, PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/**
 * Neon's pooled endpoint (`-pooler` host) runs PgBouncer in transaction mode,
 * which cannot keep server-side prepared statements across pooled connections.
 * Prisma uses prepared statements by default, so raw `$queryRaw ... FOR UPDATE`
 * calls inside an interactive transaction — the driver-accept path — fail with
 * "prepared statement already exists". Appending `pgbouncer=true` switches Prisma
 * to PgBouncer-compatible mode. No-op for direct or local connections.
 */
function poolerSafeUrl(url: string): string {
  if (!/-pooler\./.test(url) || /[?&]pgbouncer=true\b/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}pgbouncer=true`;
}

export const prisma = new PrismaClient({
  datasources: { db: { url: poolerSafeUrl(env.DATABASE_URL) } },
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/** A client bound to an interactive transaction. */
export type Tx = Prisma.TransactionClient;
