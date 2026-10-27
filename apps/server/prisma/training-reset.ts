import "dotenv/config";
import { execSync } from "node:child_process";

/**
 * A9 — nightly reset of the TRAINING database: wipe it, re-apply every
 * migration, then load the admin seed and the demo data.
 *
 * DESTRUCTIVE. Two locks stop it running anywhere else:
 *   1. APP_ENVIRONMENT must be "training"
 *   2. TRAINING_RESET_CONFIRM must be "reset-training-data"
 * Both are set only in the training deployment's own environment.
 *
 * Schedule (example, 02:00 every night on the training server):
 *   0 2 * * *  cd /app/apps/server && pnpm training:reset >> /var/log/skerp-training-reset.log 2>&1
 */

const fail = (message: string): never => {
  console.error(`training-reset: ${message}`);
  process.exit(1);
};

if (process.env.APP_ENVIRONMENT !== "training") {
  fail("refusing to run — APP_ENVIRONMENT is not 'training'.");
}
if (process.env.TRAINING_RESET_CONFIRM !== "reset-training-data") {
  fail("refusing to run — set TRAINING_RESET_CONFIRM=reset-training-data to confirm.");
}

const run = (command: string) => {
  console.log(`training-reset: ${command}`);
  execSync(command, { stdio: "inherit", env: process.env });
};

const started = Date.now();
run("npx prisma migrate reset --force");
run("npx tsx prisma/seed-admin.ts");
run("npx tsx prisma/seed-training.ts");
console.log(`training-reset: done in ${Math.round((Date.now() - started) / 1000)}s`);
