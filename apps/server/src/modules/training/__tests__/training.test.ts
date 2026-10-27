import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import {
  PERMS,
  TRAINING_MISSIONS,
  TRAINING_QUIZZES,
  TRAINING_QUIZ_PASS_PERCENT,
  TRAINING_TRACKS,
  missionStepKey,
  type PermissionKey,
  type TrainingTeamRow,
  type TrainingTrackKey,
} from "@skerp/types";
import { trainingQuizSubmitSchema } from "@skerp/validators";

vi.mock("../../../../prisma/prisma.js", () => ({ db: {} }));

import { buildTeamXlsx } from "../training.export.js";
import { gradeQuiz } from "../training.quiz.js";
import { QUIZ_KEY } from "../training.quiz-key.js";
import { resolveTracks } from "../training.tracks.js";
import { VERIFIERS } from "../training.verifiers.js";

const TRACK_KEYS = TRAINING_TRACKS.map((track) => track.key);
const allQuestions = Object.values(TRAINING_QUIZZES).flat();

/** Answers that get exactly `correct` questions right on a track. */
const answersFor = (trackKey: TrainingTrackKey, correct: number) =>
  Object.fromEntries(
    TRAINING_QUIZZES[trackKey].map((question, index) => {
      const answer = QUIZ_KEY[question.id]!.answer;
      const wrong = (answer + 1) % question.options.length;
      return [question.id, index < correct ? answer : wrong];
    }),
  );

describe("A10 quiz catalog", () => {
  it.each(TRACK_KEYS)("track %s has 5–10 questions", (trackKey) => {
    const count = TRAINING_QUIZZES[trackKey].length;
    expect(count).toBeGreaterThanOrEqual(5);
    expect(count).toBeLessThanOrEqual(10);
  });

  it("question ids are unique and accepted by the submit schema", () => {
    const ids = allQuestions.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
    const answers = Object.fromEntries(ids.map((id) => [id, 0]));
    expect(trainingQuizSubmitSchema.safeParse({ answers }).success).toBe(true);
  });

  it("every question has a valid answer and an explanation on the server", () => {
    for (const question of allQuestions) {
      const key = QUIZ_KEY[question.id];
      expect(key, question.id).toBeDefined();
      expect(key!.answer, question.id).toBeGreaterThanOrEqual(0);
      expect(key!.answer, question.id).toBeLessThan(question.options.length);
      expect(key!.explain.trim(), question.id).not.toBe("");
      // The web letters A–F and the schema's max index (9) both have to fit.
      expect(question.options.length, question.id).toBeLessThanOrEqual(6);
    }
  });

  it("has no answer key without a question", () => {
    const ids = new Set(allQuestions.map((question) => question.id));
    expect(Object.keys(QUIZ_KEY).filter((id) => !ids.has(id))).toEqual([]);
  });

  it("does not put the right answer in the same slot every time", () => {
    const slots = new Set(allQuestions.map((question) => QUIZ_KEY[question.id]!.answer));
    expect(slots.size).toBeGreaterThan(2);
  });
});

describe("gradeQuiz", () => {
  const total = TRAINING_QUIZZES.ops.length;

  it("passes with every answer right", () => {
    const result = gradeQuiz("ops", answersFor("ops", total));
    expect(result).toMatchObject({ score: total, total, percent: 100, passed: true });
    expect(result.results.every((item) => item.correct && item.explain)).toBe(true);
  });

  it(`passes exactly at ${TRAINING_QUIZ_PASS_PERCENT}%`, () => {
    const needed = Math.ceil((TRAINING_QUIZ_PASS_PERCENT / 100) * total);
    expect(gradeQuiz("ops", answersFor("ops", needed)).passed).toBe(true);
    expect(gradeQuiz("ops", answersFor("ops", needed - 1)).passed).toBe(false);
  });

  it("counts a missing answer as wrong and reports the right one", () => {
    const answers = answersFor("ops", total);
    const [first] = TRAINING_QUIZZES.ops;
    delete answers[first!.id];
    const result = gradeQuiz("ops", answers);
    expect(result.score).toBe(total - 1);
    expect(result.results[0]).toMatchObject({
      chosen: null,
      correct: false,
      answer: QUIZ_KEY[first!.id]!.answer,
    });
  });
});

describe("A9 practice missions", () => {
  it.each(TRACK_KEYS)("track %s has at least one mission", (trackKey) => {
    expect(TRAINING_MISSIONS.some((mission) => mission.trackKey === trackKey)).toBe(true);
  });

  it("have unique keys that fit a progress step key", () => {
    const keys = TRAINING_MISSIONS.map((mission) => mission.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(missionStepKey(key)).toMatch(/^mission\.[a-z0-9-]+$/);
    }
  });

  it("only use verifiers the server has", () => {
    for (const mission of TRAINING_MISSIONS) {
      for (const verifier of mission.verifiers) {
        expect(VERIFIERS[verifier], `${mission.key}: ${verifier}`).toBeTypeOf("function");
      }
      expect(mission.steps.length, mission.key).toBeGreaterThan(0);
    }
  });
});

describe("resolveTracks", () => {
  const holds =
    (...keys: PermissionKey[]) =>
    (key: PermissionKey) =>
      keys.includes(key);

  it("always requires basics, and suggests tracks from permissions", () => {
    const views = resolveTracks(holds(PERMS.ORDER.CREATE), false, []);
    const required = views.filter((view) => view.assignment === "required").map((view) => view.key);
    expect(required).toContain("basics");
    expect(required).toContain("ops");
    expect(required).not.toContain("accounts");
  });

  it("puts required tracks before optional ones", () => {
    const views = resolveTracks(() => true, false, []);
    const firstOptional = views.findIndex((view) => view.assignment === "optional");
    if (firstOptional !== -1) {
      expect(views.slice(firstOptional).every((view) => view.assignment === "optional")).toBe(true);
    }
  });

  it("makes only basics and admin required for a system role", () => {
    const required = resolveTracks(() => true, true, [])
      .filter((view) => view.assignment === "required")
      .map((view) => view.key)
      .sort();
    expect(required).toEqual(["admin", "basics"]);
  });

  it("lets admin assignments override the suggestions", () => {
    const views = resolveTracks(holds(PERMS.ORDER.CREATE), false, [
      { trackKey: "ops", required: false },
    ]);
    expect(views.find((view) => view.key === "ops")?.assignment).toBe("optional");
  });

  it("hides steps the user may not do, and tracks with none left", () => {
    const views = resolveTracks(holds(), false, []);
    expect(views.map((view) => view.key)).not.toContain("accounts");
    const basics = TRAINING_TRACKS.find((track) => track.key === "basics")!;
    const visible = basics.steps.filter((step) => !step.requires).map((step) => step.key);
    expect(views.find((view) => view.key === "basics")?.stepKeys).toEqual(visible);
  });
});

describe("team progress export (A5 + A10)", () => {
  it("shows passed / not passed for required tracks", async () => {
    const row: TrainingTeamRow = {
      userId: "u1",
      name: "Asha Trainee",
      email: "asha@example.com",
      roleName: "Operations",
      branchName: "Pune",
      required: { finished: 3, total: 10 },
      tracks: [
        { key: "basics", assignment: "required", finished: 3, total: 4, certified: true },
        { key: "ops", assignment: "required", finished: 0, total: 6, certified: false },
        { key: "rail", assignment: "optional", finished: 0, total: 5, certified: false },
      ],
      lastActivity: "2026-10-20T10:00:00.000Z",
    };
    const wb = new ExcelJS.Workbook();
    const xlsx = await buildTeamXlsx([row], new Date("2026-10-24T00:00:00Z"));
    await wb.xlsx.load(new Uint8Array(xlsx).buffer);
    const sheet = wb.getWorksheet("Training progress")!;
    const header = (sheet.getRow(1).values as unknown[]).map(String);
    const cell = (title: string) => String(sheet.getRow(2).getCell(header.indexOf(title)).value);

    expect(cell("Required quizzes passed")).toBe("1 / 2");
    const track = (key: TrainingTrackKey) =>
      cell(TRAINING_TRACKS.find((item) => item.key === key)!.title);
    expect(track("basics")).toBe("3 / 4 (required) · quiz passed");
    expect(track("ops")).toBe("0 / 6 (required) · quiz not passed");
    expect(track("rail")).toBe("0 / 5");
  });
});
