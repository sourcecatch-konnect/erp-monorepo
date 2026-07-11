import { Router } from "express";
import { tableKeySchema, upsertTablePrefSchema } from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { sendOk } from "../_shared/response.js";
import { BadRequestError, ValidationError } from "../../lib/error.js";

/**
 * Per-user UI table layouts (column order + visibility), keyed by table.
 * Purely personal data — auth is the only gate, no permission key.
 */
const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const parseTableKey = (raw: unknown): string => {
  const parsed = tableKeySchema.safeParse(raw);
  if (!parsed.success) throw new BadRequestError("Invalid table key");
  return parsed.data;
};

router.get("/:tableKey", async (req, res) => {
  const tableKey = parseTableKey(req.params.tableKey);
  const pref = await db.userTablePref.findUnique({
    where: { userId_tableKey: { userId: actorId(req), tableKey } },
    select: { prefs: true },
  });
  return sendOk(res, pref?.prefs ?? null);
});

router.put("/:tableKey", async (req, res) => {
  const tableKey = parseTableKey(req.params.tableKey);
  const parsed = upsertTablePrefSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const userId = actorId(req);
  const pref = await db.userTablePref.upsert({
    where: { userId_tableKey: { userId, tableKey } },
    create: { userId, tableKey, prefs: parsed.data },
    update: { prefs: parsed.data },
    select: { prefs: true },
  });
  return sendOk(res, pref.prefs);
});

export default router;
