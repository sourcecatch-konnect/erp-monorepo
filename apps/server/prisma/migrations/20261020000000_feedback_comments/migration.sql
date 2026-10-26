-- In-app feedback — TESTING PHASE ONLY (Jira label remove-before-prod).
-- B8: reporter ↔ team conversation + reporter's fix confirmation.
-- Removal: DROP TABLE "FeedbackComment"; DROP TYPE "FeedbackCommentKind", "FeedbackCommentSide";

-- CreateEnum
CREATE TYPE "FeedbackCommentKind" AS ENUM ('COMMENT', 'STATUS_CHANGE', 'CONFIRMED_FIXED', 'STILL_BROKEN');

-- CreateEnum
CREATE TYPE "FeedbackCommentSide" AS ENUM ('REPORTER', 'TEAM');


-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "reporterConfirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FeedbackComment" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "side" "FeedbackCommentSide" NOT NULL,
    "kind" "FeedbackCommentKind" NOT NULL DEFAULT 'COMMENT',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackComment_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX "FeedbackComment_feedbackId_createdAt_idx" ON "FeedbackComment"("feedbackId", "createdAt");

-- AddForeignKey
ALTER TABLE "FeedbackComment" ADD CONSTRAINT "FeedbackComment_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
