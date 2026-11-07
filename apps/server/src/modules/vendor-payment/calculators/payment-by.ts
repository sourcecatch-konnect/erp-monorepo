import type { DeliveryChallanPaymentBy } from "../../../../generated/prisma/index.js";

/**
 * Who may be paid for a delivery challan — the LDC payable rule (Q1).
 *
 * Pure on purpose: no Prisma, no I/O, nothing but the rule itself, so it can
 * be unit-tested without a database. Same split as
 * `detention.engine.ts` (pure) vs `detention.service.ts` (loads rows) — the
 * query that uses this lives in `ldc-broker.ts`.
 */

/**
 * `DeliveryChallan.paymentBy` answers "who bears this cost" — the schema says
 * so: *"Who bears the last-mile freight. Drives whether the challan becomes a
 * broker payable at all."* Confirmed with the business on 2026-11-06 (Q1):
 * **COMPANY is the only responsible party for an LDC broker payment.**
 *
 * This is a deliberate **allowlist, not a denylist**. `CLIENT`, `TRANSPORTER`,
 * `CASH`, `null`, and any value added to the enum in future all fall through
 * to the review queue and can never be paid by accident. The two failure
 * modes are not symmetrical: an over-restrictive list strands a challan
 * somewhere visible where a human notices, while an over-permissive one pays
 * money we may not owe and nobody notices.
 *
 * Payment *mode* (cash / bank / cheque) is a separate thing and lives on the
 * disbursement (`VendorPaymentDisbursement.mode`), not here. `CASH` appearing
 * in this enum is a mode leaking into a responsibility field — which is
 * exactly why those rows go to review rather than being guessed either way
 * (Q20).
 */
export const PAYABLE_PAYMENT_BY: readonly DeliveryChallanPaymentBy[] = [
  "COMPANY",
] as const;

export const isPayablePaymentBy = (
  value: DeliveryChallanPaymentBy | null,
): boolean => value !== null && PAYABLE_PAYMENT_BY.includes(value);

/**
 * Why a challan this broker hauled is not on the payable list. Shown verbatim
 * in the review queue, so an operator can act on it without reading code.
 */
export const reviewReasonFor = (
  paymentBy: DeliveryChallanPaymentBy | null,
): string => {
  switch (paymentBy) {
    case null:
      return "Payment-by was never recorded on this challan — set it before the broker can be paid";
    case "CLIENT":
      return "Marked payable by the client — the customer settles with the broker directly";
    case "TRANSPORTER":
      return "Marked borne by the transporter — not a company payable";
    case "CASH":
      // Q20 is open: CASH may mean "already settled in cash" (paying again
      // would be a double payment) or "company owes it, to be paid in cash".
      // The copy must prompt a check, never assert either reading.
      return "Marked CASH — confirm whether the broker was already paid in cash before raising a slip";
    default:
      return `Payment-by "${paymentBy}" is not a company payable`;
  }
};
