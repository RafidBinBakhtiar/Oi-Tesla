import { Prisma, PrismaClient } from '@prisma/client';
import { env } from '../config/env';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/** A client bound to an interactive transaction. */
export type Tx = Prisma.TransactionClient;
