import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveDbUrl(): string {
  const url = (process.env.DATABASE_URL ?? "file:./dev.db")
    .trim()
    .replace(/^["']|["']$/g, "");
  const filePath = url.startsWith("file:") ? url.slice(5) : url;
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  return `file:${absolute}`;
}

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: resolveDbUrl() });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
