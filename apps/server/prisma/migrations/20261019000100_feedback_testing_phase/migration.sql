-- In-app feedback — TESTING PHASE ONLY (Jira label remove-before-prod).
-- No foreign keys in or out: dropping this table touches nothing else.
-- Removal: DROP TABLE "Feedback"; DROP TYPE "FeedbackCategory", "FeedbackStatus", "FeedbackSeverity";

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'FLOW', 'UI', 'FINDABILITY', 'SUGGESTION');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'TRIAGED', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "FeedbackSeverity" AS ENUM ('BLOCKER', 'MAJOR', 'MINOR');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "details" JSONB NOT NULL,
    "severity" "FeedbackSeverity",
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "pagePath" TEXT NOT NULL,
    "pageTitle" TEXT NOT NULL,
    "moduleLabel" TEXT NOT NULL,
    "entityId" TEXT,
    "context" JSONB NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reporterName" TEXT NOT NULL,
    "reporterRole" TEXT NOT NULL,
    "reporterBranch" TEXT,
    "assignee" TEXT,
    "devNotes" TEXT,
    "externalRef" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX "Feedback_number_key" ON "Feedback"("number");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Feedback_category_idx" ON "Feedback"("category");

-- CreateIndex
CREATE INDEX "Feedback_moduleLabel_pagePath_idx" ON "Feedback"("moduleLabel", "pagePath");

-- CreateIndex
CREATE INDEX "Feedback_reporterId_idx" ON "Feedback"("reporterId");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

