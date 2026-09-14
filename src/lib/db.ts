import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  initializedPragmas?: boolean;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  });

// Configure SQLite high-concurrency PRAGMAs (WAL mode, busy_timeout, synchronous normal)
if (!globalForPrisma.initializedPragmas) {
  globalForPrisma.initializedPragmas = true;
  (async () => {
    try {
      await db.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
      await db.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
      await db.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
      await db.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
      await db.$queryRawUnsafe('PRAGMA cache_size = -20000;');
    } catch (e) {
      // Ignored for non-sqlite or during build
    }
  })();
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

