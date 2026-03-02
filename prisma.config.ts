import "dotenv/config";
import path from "path";
import { defineConfig } from "prisma/config";

function resolveDbUrl(): string {
  // Docker --env-file passes quotes literally; strip them before processing.
  const raw = (process.env["DATABASE_URL"] ?? "file:./dev.db")
    .trim()
    .replace(/^["']|["']$/g, "");
  const filePath = raw.startsWith("file:") ? raw.slice(5) : raw;
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  return `file:${absolute}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDbUrl(),
  },
});
