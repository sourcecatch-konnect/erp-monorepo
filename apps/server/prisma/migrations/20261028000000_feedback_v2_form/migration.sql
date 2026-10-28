-- In-app feedback v2 — TESTING PHASE ONLY (Jira label remove-before-prod).
-- docs/FEEDBACK_V2_PLAN.md §5. Back up first: run feedback.archive.ts.
-- Hand-written: Prisma's generated version casts old category values straight
-- to the new enum (fails on rows that use a removed value) and doesn't carry
-- severity over into impact.

-- 1. New types, mapping the old ones (v1 answers stay in "details").
ALTER TYPE "FeedbackCategory" RENAME TO "FeedbackCategory_v1";
CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'IMPROVEMENT', 'MISSING_FEATURE', 'CONFUSING', 'DATA_ISSUE', 'TRAINING_HELP', 'OTHER');
ALTER TABLE "Feedback"
  ALTER COLUMN "category" TYPE "FeedbackCategory"
  USING (
    CASE "category"::text
      WHEN 'BUG' THEN 'BUG'
      WHEN 'FINDABILITY' THEN 'CONFUSING'
      ELSE 'IMPROVEMENT' -- FLOW, UI, SUGGESTION
    END
  )::"FeedbackCategory";
DROP TYPE "FeedbackCategory_v1";

-- 2. Impact replaces severity, on every item.
CREATE TYPE "FeedbackImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
ALTER TABLE "Feedback" ADD COLUMN "impact" "FeedbackImpact" NOT NULL DEFAULT 'MEDIUM';
UPDATE "Feedback" SET "impact" = (
  CASE "severity"::text
    WHEN 'BLOCKER' THEN 'CRITICAL'
    WHEN 'MAJOR' THEN 'HIGH'
    WHEN 'MINOR' THEN 'LOW'
    ELSE 'MEDIUM'
  END
)::"FeedbackImpact";
ALTER TABLE "Feedback" DROP COLUMN "severity";
DROP TYPE "FeedbackSeverity";

-- 3. New fields.
ALTER TABLE "Feedback" ADD COLUMN "points" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Feedback" ADD COLUMN "section" TEXT;
ALTER TABLE "Feedback" ADD COLUMN "voiceSeconds" INTEGER;
ALTER TABLE "Feedback" ALTER COLUMN "details" SET DEFAULT '{}';

-- CreateIndex
CREATE INDEX "Feedback_impact_idx" ON "Feedback"("impact");
