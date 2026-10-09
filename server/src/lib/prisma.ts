import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;
let dbConnected = false;

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prismaInstance;
}

export const prisma = getPrisma();

export async function checkDbConnection(): Promise<boolean> {
  try {
    const client = getPrisma();
    await client.$queryRaw`SELECT 1`;
    dbConnected = true;
    return true;
  } catch (err) {
    dbConnected = false;
    return false;
  }
}

export function isDbConnected(): boolean {
  return dbConnected;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
    dbConnected = false;
  }
}
