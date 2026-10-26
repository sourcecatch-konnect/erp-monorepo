import type { OrderStatus } from "@skerp/types";
import type { PageHelpContent } from "@/features/training";

/** Help panel for the Orders list (A7). Review with the Operations team. */
export const ORDERS_HELP: PageHelpContent = {
  title: "Orders",
  purpose:
    "Every customer request to move goods starts here as an order. See all orders, their status and what still needs to happen.",
  stage: "booking.order",
  howTo: [
    "Press New Order to book a customer's request.",
    "Pick the customer, the from and to branch, the pickup date and the number of trucks.",
    "Save it. The order goes to 'Pending approval' for a manager.",
    "Click a row to see the order, approve it, or create its LRs.",
  ],
  next:
    "A manager confirms or rejects the order. Once it is Confirmed, its LRs can be created.",
  mistakes: [
    "Booking before the customer has a rate for this route, so the freight comes out empty.",
    "Making a second order for the same trucks instead of editing the first one.",
  ],
  terms: ["order", "rate-matrix", "tbb", "to-pay"],
  trainingStep: "ops.book-order",
};

export type NextStepHint = {
  title: string;
  text: string;
  action?: { label: string; href: string };
};

/** "What now?" for an order, from its status (shown on the order page). */
export function orderNextStep(
  status: OrderStatus,
  options: { orderId: string; canApprove: boolean; canCreateLr: boolean; canViewTrips: boolean },
): NextStepHint | null {
  switch (status) {
    case "PendingApproval":
      return options.canApprove
        ? {
            title: "This order is waiting for your approval",
            text: "Check the freight and the contact person, then press Approve, or Reject with a reason.",
          }
        : {
            title: "Waiting for a manager to approve this order",
            text: "Once it is Confirmed you can create its LRs.",
          };
    case "Confirmed":
      return {
        title: "Order confirmed. Next: create the LRs",
        text: "Make one LR for each consignment on this order.",
        action: options.canCreateLr
          ? {
              label: "Create LR",
              href: `/lorry-receipts/new?orderId=${encodeURIComponent(options.orderId)}`,
            }
          : undefined,
      };
    case "LRCreated":
    case "InProgress":
      return {
        title: "LRs are made. Next: get the goods moving",
        text: "Put the LRs on a trip, or on a VP schedule if they go by rail.",
        action: options.canViewTrips ? { label: "Open trips", href: "/trips" } : undefined,
      };
    default:
      return null;
  }
}
