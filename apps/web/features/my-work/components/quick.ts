import type { MyWorkPriorityRow, MyWorkQueueKey } from "@skerp/types";

/**
 * Queues whose button can finish the step right on the My Work page, using
 * the same dialog and save logic as the screen that normally owns the step.
 * Everything else opens its own screen.
 */
export type QuickKind = "confirm-order" | "deliver" | "ack" | "approve";

export const QUICK_BY_QUEUE: Partial<Record<MyWorkQueueKey, QuickKind>> = {
  orders_to_confirm: "confirm-order",
  late_deliveries: "deliver",
  pending_ack: "ack",
  // Simple yes/no approvals: a short confirm with the key facts.
  receipts_approve: "approve",
  vendor_payments: "approve",
  trip_expenses: "approve",
  salary_runs: "approve",
  po_approve: "approve",
};

export type QuickAction = {
  kind: QuickKind;
  /** The document id (order, LR, receipt, slip, …). */
  id: string;
  /** The document number. */
  number: string;
  /** The row itself, for "approve" — its facts are shown before approving. */
  row?: MyWorkPriorityRow;
};
