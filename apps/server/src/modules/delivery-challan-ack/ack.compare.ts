/**
 * Quantities and approval prefills derived from a broker acknowledgement —
 * pure, no I/O.
 *
 * This file once compared two acknowledgements side by side: SK's supervisor
 * against the broker, whose claim is "often inflated" (CONTEXT.md §5.2).
 * That comparison was dropped on 2026-11-07 along with the supervisor
 * acknowledgement itself — the supervisor is a `Labour` record with no ERP
 * login, so both accounts were always going to be typed by the same staff
 * and the comparison proved nothing. The control on an inflated claim is the
 * **slab ceiling** applied on the payment slip, which pays
 * `min(claimed, slab)`.
 *
 * Nothing here decides anything. It derives figures; an approver rules.
 */

export type AckItemLite = {
  challanItemId: string;
  lrNumberSnapshot: string;
  totalQty: number;
  receivedQty: number;
  damageQty: number;
};

export type AckLite = {
  reportingDate: Date | null;
  unloadingDate: Date | null;
  collectionDate: Date | null;
  claimedDetentionDays: number | null;
  claimedDetentionPaise: bigint | null;
  parkingPaise: bigint | null;
  otherPaise: bigint | null;
  labourPaise: bigint | null;
  damagePaise: bigint | null;
  items: AckItemLite[];
};

/** Shortage is always derived, never stored, so it cannot drift from the
 *  quantities it comes from. */
export const shortageQtyOf = (item: AckItemLite): number =>
  Math.max(item.totalQty - item.receivedQty, 0);

export const totalShortageQty = (ack: AckLite): number =>
  ack.items.reduce((sum, item) => sum + shortageQtyOf(item), 0);

export const totalDamageQty = (ack: AckLite): number =>
  ack.items.reduce((sum, item) => sum + item.damageQty, 0);

/**
 * The figures an approver starts from, defaulted off the broker's
 * acknowledgement. They remain free to edit every one — this is a prefill,
 * not a rule — but it means approving with no edits records exactly what the
 * broker claimed.
 */
export const approvalDefaultsFrom = (ack: AckLite) => ({
  approvedDetentionDays: ack.claimedDetentionDays,
  approvedParkingPaise: ack.parkingPaise,
  approvedOtherPaise: ack.otherPaise,
  approvedLabourPaise: ack.labourPaise,
  approvedDamagePaise: ack.damagePaise,
  /** Quantity-derived, so there is no claimed money figure to copy — the
   *  approver prices the shortage if it is to be recovered. */
  approvedShortagePaise: null as bigint | null,
});
