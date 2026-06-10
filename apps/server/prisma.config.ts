import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    url: env("DIRECT_URL"),
    // Empty Neon DB Prisma replays migrations into to diff/generate them (Supabase can't auto-create a shadow).
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
});
