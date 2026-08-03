import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const isGenerateCommand = process.argv.some((arg) => arg === "generate");
const generateOnlyUrl = "postgresql://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    // `prisma generate` reads this config but does not connect to the database.
    // Keep migrate/status/deploy strict so missing DIRECT_URL is still caught.
    url: process.env.DIRECT_URL ?? (isGenerateCommand ? generateOnlyUrl : env("DIRECT_URL")),
    // Empty Neon DB Prisma replays migrations into to diff/generate them (Supabase can't auto-create a shadow).
    // shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
});
