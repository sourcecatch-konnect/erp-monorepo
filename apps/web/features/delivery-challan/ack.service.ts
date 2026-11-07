import type { ApiResponse } from "@skerp/types";

import { unwrapApiResponse } from "@/features/masters/_shared/master-api";
import { api } from "@/lib/api";

/**
 * DC Acknowledgement + Approval (LDC phase L5).
 *
 * One acknowledgement per challan: the broker's claim, transcribed by staff
 * from his bill and email. An approver then rules on it. SK's own side of
 * the delivery is the challan's Labour supervisor and the LR dates.
 */

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

export type ChallanApproval = {
  id: string;
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
  /** The challan's own lines, so the form can be laid out and quantities
   *  prefilled before the broker's claim has been entered. */
  lines: { id: string; lrNumberSnapshot: string; quantity: number }[];
  broker: ChallanAck | null;
  /** The Labour supervisor who ran the unloading — SK's own side, held on
   *  the challan rather than acknowledged. */
  supervisor: { id: string; name: string } | null;
  filed: boolean;
  approval: ChallanApproval | null;
};

export type UpsertAckBody = {
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
      await api.put<ApiResponse<{ id: string }>>(
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
