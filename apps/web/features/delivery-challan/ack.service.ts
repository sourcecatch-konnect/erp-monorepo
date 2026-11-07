import type { ApiResponse } from "@skerp/types";

import { unwrapApiResponse } from "@/features/masters/_shared/master-api";
import { api } from "@/lib/api";

/**
 * DC Acknowledgement + Approval (LDC phase L5).
 *
 * Two parties file independently, an approver rules between them. The server
 * computes the mismatch list — it is the fraud control, so it is not
 * recomputed in the browser where it could drift from what was approved.
 */

export type DeliveryChallanAckType = "SUPERVISOR" | "BROKER";

export type AckItem = {
  id: string;
  challanItemId: string;
  lrNumberSnapshot: string;
  totalQty: number;
  receivedQty: number;
  damageQty: number;
  /** Derived server-side as sent − received. */
  shortageQty: number;
};

export type ChallanAck = {
  id: string;
  ackType: DeliveryChallanAckType;
  reportingDate: string | null;
  unloadingDate: string | null;
  collectionDate: string | null;
  claimedDetentionDays: number | null;
  claimedDetentionPaise: string | null;
  parkingPaise: string | null;
  otherPaise: string | null;
  labourPaise: string | null;
  damagePaise: string | null;
  remarks: string | null;
  podAttachmentId: string | null;
  filedAt: string;
  version: number;
  filedBy: { id: string; firstName: string; lastName: string } | null;
  items: AckItem[];
  totalShortageQty: number;
  totalDamageQty: number;
};

/** One field the two accounts disagree on. Values are pre-stringified by the
 *  server so the comparison is exactly what it compared. */
export type AckMismatch = {
  field: string;
  supervisor: string | null;
  broker: string | null;
};

export type ChallanApproval = {
  id: string;
  acceptedAckType: DeliveryChallanAckType;
  acceptedAckId: string;
  approvedDetentionDays: number | null;
  approvedParkingPaise: string | null;
  approvedOtherPaise: string | null;
  approvedLabourPaise: string | null;
  approvedDamagePaise: string | null;
  approvedShortagePaise: string | null;
  remarks: string | null;
  approvedAt: string;
  version: number;
  approvedBy: { id: string; firstName: string; lastName: string } | null;
};

export type ChallanAckView = {
  challanId: string;
  challanNumber: string;
  status: string;
  /** The challan's own lines, so a form can be laid out and quantities
   *  prefilled before either party has filed. */
  lines: { id: string; lrNumberSnapshot: string; quantity: number }[];
  supervisor: ChallanAck | null;
  broker: ChallanAck | null;
  mismatches: AckMismatch[];
  bothFiled: boolean;
  approval: ChallanApproval | null;
};

export type UpsertAckBody = {
  ackType: DeliveryChallanAckType;
  reportingDate?: string | null;
  unloadingDate?: string | null;
  collectionDate?: string | null;
  claimedDetentionDays?: number | null;
  claimedDetentionPaise?: string | null;
  parkingPaise?: string | null;
  otherPaise?: string | null;
  labourPaise?: string | null;
  damagePaise?: string | null;
  remarks?: string | null;
  items: {
    challanItemId: string;
    totalQty: number;
    receivedQty: number;
    damageQty: number;
  }[];
  version?: number;
};

export type ApproveChallanBody = {
  acceptedAckType: DeliveryChallanAckType;
  approvedDetentionDays?: number | null;
  approvedParkingPaise?: string | null;
  approvedOtherPaise?: string | null;
  approvedLabourPaise?: string | null;
  approvedDamagePaise?: string | null;
  approvedShortagePaise?: string | null;
  remarks?: string | null;
};

export const challanAckApi = {
  view: async (challanId: string): Promise<ChallanAckView> =>
    unwrapApiResponse(
      await api.get<ApiResponse<ChallanAckView>>(
        `/delivery-challans/${challanId}/acknowledgements`,
      ),
    ),

  upsert: async (challanId: string, body: UpsertAckBody) =>
    unwrapApiResponse(
      await api.put<ApiResponse<{ id: string; ackType: DeliveryChallanAckType }>>(
        `/delivery-challans/${challanId}/acknowledgements`,
        body,
      ),
    ),

  approve: async (challanId: string, body: ApproveChallanBody) =>
    unwrapApiResponse(
      await api.post<ApiResponse<{ id: string }>>(
        `/delivery-challans/${challanId}/approval`,
        body,
      ),
    ),

  revokeApproval: async (
    challanId: string,
    body: { reason: string; version: number },
  ) =>
    unwrapApiResponse(
      await api.post<ApiResponse<{ id: string; revoked: boolean }>>(
        `/delivery-challans/${challanId}/approval/revoke`,
        body,
      ),
    ),
};

export const challanAckKeys = {
  view: (challanId: string) => ["delivery-challan", challanId, "acks"] as const,
};
