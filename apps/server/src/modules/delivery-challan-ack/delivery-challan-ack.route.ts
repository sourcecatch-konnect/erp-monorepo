import { Router } from "express";

import {
  approveDeliveryChallanSchema,
  revokeDeliveryChallanApprovalSchema,
  upsertDeliveryChallanAckSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess } from "../../auth/branch-scope.js";
import { ValidationError, NotFoundError } from "../../lib/error.js";
import { db } from "../../../prisma/prisma.js";
import { getParamId } from "../_shared/param.js";
import { sendOk } from "../_shared/response.js";
import {
  approveChallan,
  getChallanAckView,
  revokeChallanApproval,
  upsertChallanAck,
} from "./delivery-challan-ack.service.js";

/**
 * DC Acknowledgement + Approval (LDC phase L5).
 *
 * Mounted under `/delivery-challans` so these sit alongside the challan they
 * belong to. Three permissions, deliberately distinct: filing as the
 * supervisor, filing as the broker, and ruling between them. One role holding
 * both a filing permission and `approve` defeats the control — that is a
 * matter for role configuration, which is why the permissions exist
 * separately at all.
 */
const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const validate = <T>(
  result:
    | { success: true; data: T }
    | {
        success: false;
        error: { flatten: () => { fieldErrors: Record<string, string[]> } };
      },
) => {
  if (!result.success)
    throw new ValidationError(result.error.flatten().fieldErrors);
  return result.data;
};

/** Challans are branch-scoped; every handler checks the source branch. */
const assertChallanBranch = async (
  req: Parameters<typeof assertBranchAccess>[0],
  challanId: string,
) => {
  const challan = await db.deliveryChallan.findUnique({
    where: { id: challanId },
    select: { sourceBranchId: true },
  });
  if (!challan) throw new NotFoundError("Delivery Challan not found");
  assertBranchAccess(req, challan.sourceBranchId);
};

/**
 * Both acknowledgements side by side plus the mismatch list — the comparison
 * screen. Readable by anyone who can view a challan; acting on it needs one
 * of the three permissions below.
 */
router.get(
  "/:id/acknowledgements",
  can(PERMS.DELIVERY_CHALLAN.VIEW),
  async (req, res) => {
    const id = getParamId(req);
    await assertChallanBranch(req, id);
    return sendOk(res, await getChallanAckView(id));
  },
);

/**
 * File or amend an acknowledgement.
 *
 * The permission required depends on which party is filing, so a supervisor
 * cannot file the broker's claim or the reverse — that separation is the
 * whole point of having two acks.
 */
router.put(
  "/:id/acknowledgements",
  async (req, res, next) => {
    // Gate on the ackType in the body, so the check happens before any work.
    const parsed = upsertDeliveryChallanAckSchema.safeParse(req.body);
    if (!parsed.success)
      return next(new ValidationError(parsed.error.flatten().fieldErrors));
    const permission =
      parsed.data.ackType === "SUPERVISOR"
        ? PERMS.DELIVERY_CHALLAN.ACK_SUPERVISOR
        : PERMS.DELIVERY_CHALLAN.ACK_BROKER;
    return can(permission)(req, res, next);
  },
  async (req, res) => {
    const id = getParamId(req);
    await assertChallanBranch(req, id);
    const input = validate(upsertDeliveryChallanAckSchema.safeParse(req.body));
    const ackId = await upsertChallanAck(id, input, actorId(req));
    return sendOk(res, { id: ackId, ackType: input.ackType });
  },
);

/** Accept one acknowledgement and record the approved figures. Posts nothing. */
router.post(
  "/:id/approval",
  can(PERMS.DELIVERY_CHALLAN.APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    await assertChallanBranch(req, id);
    const input = validate(approveDeliveryChallanSchema.safeParse(req.body));
    const approvalId = await approveChallan(id, input, actorId(req));
    return sendOk(res, { id: approvalId }, undefined, 201);
  },
);

/** Undo a ruling so the acknowledgements can be corrected. Refused once the
 *  challan is on a payment slip. */
router.post(
  "/:id/approval/revoke",
  can(PERMS.DELIVERY_CHALLAN.APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    await assertChallanBranch(req, id);
    const input = validate(
      revokeDeliveryChallanApprovalSchema.safeParse(req.body),
    );
    await revokeChallanApproval(id, input.version, input.reason);
    return sendOk(res, { id, revoked: true });
  },
);

export default router;
