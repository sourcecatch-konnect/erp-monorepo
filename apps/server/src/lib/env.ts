import "dotenv/config";

import { defaultServerPort } from "@skerp/config";

export const env = {
  port: Number(process.env.PORT ?? defaultServerPort),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
};
