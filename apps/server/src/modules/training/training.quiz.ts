import { Router } from "express";
import { trainingQuizSubmitSchema } from "@skerp/validators";
import {
  TRAINING_QUIZ_PASS_PERCENT,
  TRAINING_QUIZZES,
  TRAINING_TRACKS,
  type PermissionKey,
  type TrainingCertification,
  type TrainingQuizResult,
  type TrainingQuizView,
  type TrainingTrackKey,
} from "@skerp/types";

import type { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { NotFoundError, ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { QUIZ_KEY } from "./training.quiz-key.js";

/**
 * A10 — track quizzes. Questions come from @skerp/types; grading and the
 * explanations stay here. Mounted at /training/quiz (auth already applied).
 */

const TRACK_KEYS = new Set<string>(TRAINING_TRACKS.map((track) => track.key));

const isTrackKey = (value: string): value is TrainingTrackKey => TRACK_KEYS.has(value);

/** Best result per user per track, and when they first passed. */
export async function certificationsFor(
  userIds: string[],
): Promise<Map<string, Map<TrainingTrackKey, TrainingCertification>>> {
  const out = new Map<string, Map<TrainingTrackKey, TrainingCertification>>();
  if (userIds.length === 0) return out;
  const attempts = await db.trainingQuizAttempt.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, trackKey: true, score: true, total: true, passed: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  for (const attempt of attempts) {
    if (!isTrackKey(attempt.trackKey)) continue;
    const byTrack = out.get(attempt.userId) ?? new Map<TrainingTrackKey, TrainingCertification>();
    const current = byTrack.get(attempt.trackKey);
    byTrack.set(attempt.trackKey, {
      trackKey: attempt.trackKey,
      passed: (current?.passed ?? false) || attempt.passed,
      bestScore: Math.max(current?.bestScore ?? 0, attempt.score),
      total: attempt.total,
      passedAt:
        current?.passedAt ?? (attempt.passed ? attempt.createdAt.toISOString() : null),
    });
    out.set(attempt.userId, byTrack);
  }
  return out;
}

/** A user can take a track's quiz if they can see at least one of its steps. */
const findTrackFor = (trackKey: string, has: (key: PermissionKey) => boolean) => {
  const track = TRAINING_TRACKS.find((t) => t.key === trackKey);
  if (!track || !track.steps.some((step) => !step.requires || has(step.requires))) {
    throw new NotFoundError("This training isn't part of your role");
  }
  return track;
};

export function gradeQuiz(
  trackKey: TrainingTrackKey,
  answers: Record<string, number>,
): TrainingQuizResult {
  const questions = TRAINING_QUIZZES[trackKey];
  const results = questions.map((question) => {
    const key = QUIZ_KEY[question.id];
    const chosen = answers[question.id] ?? null;
    return {
      id: question.id,
      chosen,
      answer: key?.answer ?? -1,
      correct: key !== undefined && chosen === key.answer,
      explain: key?.explain ?? "",
    };
  });
  const score = results.filter((result) => result.correct).length;
  const total = questions.length;
  const percent = total === 0 ? 0 : Math.round((score / total) * 100);
  return { score, total, percent, passed: percent >= TRAINING_QUIZ_PASS_PERCENT, results };
}

const router: Router = Router();

router.get("/:trackKey", async (req, res) => {
  const ctx = req.ctx!;
  const track = findTrackFor(String(req.params.trackKey), (key) => ctx.permissions.has(key));
  const [attempts, certifications] = await Promise.all([
    db.trainingQuizAttempt.count({ where: { userId: ctx.userId, trackKey: track.key } }),
    certificationsFor([ctx.userId]),
  ]);
  const body: TrainingQuizView = {
    trackKey: track.key,
    questions: [...TRAINING_QUIZZES[track.key]],
    passPercent: TRAINING_QUIZ_PASS_PERCENT,
    attempts,
    best: certifications.get(ctx.userId)?.get(track.key) ?? null,
  };
  return sendOk(res, body);
});

router.post("/:trackKey", async (req, res) => {
  const ctx = req.ctx!;
  const track = findTrackFor(String(req.params.trackKey), (key) => ctx.permissions.has(key));
  const parsed = trainingQuizSubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const unanswered = TRAINING_QUIZZES[track.key].filter(
    (question) => parsed.data.answers[question.id] === undefined,
  );
  if (unanswered.length > 0) {
    throw new ValidationError({ answers: ["Please answer every question"] });
  }

  const result = gradeQuiz(track.key, parsed.data.answers);
  await db.trainingQuizAttempt.create({
    data: {
      userId: ctx.userId,
      trackKey: track.key,
      score: result.score,
      total: result.total,
      passed: result.passed,
      answers: parsed.data.answers as Prisma.InputJsonValue,
    },
  });
  return sendOk(res, result, undefined, 201);
});

export default router;
