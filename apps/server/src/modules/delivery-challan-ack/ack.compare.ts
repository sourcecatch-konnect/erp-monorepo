import type { DeliveryChallanAckType } from "../../../generated/prisma/index.js";

/**
 * Comparing the two acknowledgements on a delivery challan — pure, no I/O.
 *
 * The supervisor says what was received; the broker files their own claim,
 * "often inflated" (CONTEXT.md §5.2). Putting the two side by side and
 * naming every field where they disagree *is* the fraud control, so the
 * comparison lives here on its own and is unit-tested, rather than being
 * computed inline in a route or, worse, in the browser.
 *
 * Nothing here decides anything. It reports differences; an approver rules.
 */

export type AckItemLite = {
  challanItemId: string;
  lrNumberSnapshot: string;
  totalQty: number;
  receivedQty: number;
  damageQty: number;
};

export type AckLite = {
  ackType: DeliveryChallanAckType;
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

/** The fields worth comparing, in the order a reviewer reads them. */
export type AckMismatchField =
  | "reportingDate"
  | "unloadingDate"
  | "collectionDate"
  | "claimedDetentionDays"
  | "claimedDetentionPaise"
  | "parkingPaise"
  | "otherPaise"
  | "labourPaise"
  | "damagePaise"
  | "shortageQty"
  | "damageQty";

export type AckMismatch = {
  field: AckMismatchField;
  supervisor: string | null;
  broker: string | null;
};

const dateKey = (value: Date | null): string | null =>
  value ? value.toISOString() : null;

const numKey = (value: number | bigint | null): string | null =>
  value === null ? null : String(value);

/**
 * Every field on which the two acknowledgements disagree.
 *
 * A field where **both** sides are blank is not a disagreement. A field where
 * **one** side is blank and the other is not *is* one, and a loud one — it
 * usually means somebody has not filled their form in rather than that the
 * two genuinely differ, and an approver needs to see that before ruling.
 *
 * Returns `[]` when the two agree on everything, and also when one of them
 * has not been filed at all: there is nothing to compare against one ack, and
 * reporting the whole form as mismatched would bury the real signal. Whether
 * both acks exist is a separate question the caller answers.
 */
export const compareAcks = (
  supervisor: AckLite | null,
  broker: AckLite | null,
): AckMismatch[] => {
  if (!supervisor || !broker) return [];

  const rows: { field: AckMismatchField; a: string | null; b: string | null }[] =
    [
      {
        field: "reportingDate",
        a: dateKey(supervisor.reportingDate),
        b: dateKey(broker.reportingDate),
      },
      {
        field: "unloadingDate",
        a: dateKey(supervisor.unloadingDate),
        b: dateKey(broker.unloadingDate),
      },
      {
        field: "collectionDate",
        a: dateKey(supervisor.collectionDate),
        b: dateKey(broker.collectionDate),
      },
      {
        field: "claimedDetentionDays",
        a: numKey(supervisor.claimedDetentionDays),
        b: numKey(broker.claimedDetentionDays),
      },
      {
        field: "claimedDetentionPaise",
        a: numKey(supervisor.claimedDetentionPaise),
        b: numKey(broker.claimedDetentionPaise),
      },
      {
        field: "parkingPaise",
        a: numKey(supervisor.parkingPaise),
        b: numKey(broker.parkingPaise),
      },
      {
        field: "otherPaise",
        a: numKey(supervisor.otherPaise),
        b: numKey(broker.otherPaise),
      },
      {
        field: "labourPaise",
        a: numKey(supervisor.labourPaise),
        b: numKey(broker.labourPaise),
      },
      {
        field: "damagePaise",
        a: numKey(supervisor.damagePaise),
        b: numKey(broker.damagePaise),
      },
      {
        field: "shortageQty",
        a: numKey(totalShortageQty(supervisor)),
        b: numKey(totalShortageQty(broker)),
      },
      {
        field: "damageQty",
        a: numKey(totalDamageQty(supervisor)),
        b: numKey(totalDamageQty(broker)),
      },
    ];

  return rows
    .filter((row) => !(row.a === null && row.b === null) && row.a !== row.b)
    .map((row) => ({ field: row.field, supervisor: row.a, broker: row.b }));
};

/**
 * The figures an approver starts from, defaulted off whichever ack they
 * accepted. They remain free to edit every one — this is a prefill, not a
 * rule — but it means accepting a version with no edits records exactly what
 * that version said.
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
