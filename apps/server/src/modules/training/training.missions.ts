import { Router } from "express";
import {
  TRAINING_MISSIONS,
  TRAINING_TRACKS,
  missionStepKey,
  type PermissionKey,
  type TrainingMissionView,
} from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { sendOk } from "../_shared/response.js";
import { VERIFIERS } from "./training.verifiers.js";

/**
 * A9 — practice missions. Mounted at /training/missions only when
 * APP_ENVIRONMENT=training: the missions talk about the demo data, which
 * only exists there.
 *
 * Self-marked missions are saved through POST /training/progress with step
 * key `mission.<key>`; checked missions re-run the A6 verifiers.
 */
const router: Router = Router();

router.get("/", async (req, res) => {
  const ctx = req.ctx!;
  const has = (key: PermissionKey) => ctx.permissions.has(key);
  const visibleTracks = new Set(
    TRAINING_TRACKS.filter((track) =>
      track.steps.some((step) => !step.requires || has(step.requires)),
    ).map((track) => track.key),
  );
  const missions = TRAINING_MISSIONS.filter((mission) => visibleTracks.has(mission.trackKey));

  const marked = new Set(
    (
      await db.trainingProgress.findMany({
        where: {
          userId: ctx.userId,
          stepKey: { in: missions.map((mission) => missionStepKey(mission.key)) },
          status: "DONE",
        },
        select: { stepKey: true },
      })
    ).map((row) => row.stepKey),
  );

  const views: TrainingMissionView[] = await Promise.all(
    missions.map(async (mission) => {
      const checks = await Promise.all(
        mission.verifiers.map(async (verifier) => ({
          verifier,
          done: await VERIFIERS[verifier](ctx.userId),
        })),
      );
      const done =
        checks.length > 0
          ? checks.every((check) => check.done)
          : marked.has(missionStepKey(mission.key));
      return { key: mission.key, done, checks };
    }),
  );
  return sendOk(res, views);
});

export default router;
