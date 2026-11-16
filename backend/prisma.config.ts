
// Prisma CLI config. Normalize DATABASE_URL to tolerate common deployment formatting
// issues (e.g. accidental surrounding quotes/whitespace in hosted env vars).
import "dotenv/config";
import { defineConfig } from "prisma/config";

const normalizeEnvUrl = (value?: string) => {
  if (typeof value !== "string") return "";
  let v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
};

const databaseUrl = normalizeEnvUrl(process.env.DATABASE_URL);
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required (expected to start with postgresql:// or postgres://)");
}

process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: databaseUrl,
  },
});
