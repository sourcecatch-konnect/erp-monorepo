import {
  IconClipboardList,
  IconFileInvoice,
  IconReceipt2,
  IconRoute,
  IconTool,
  IconTruckDelivery,
  type Icon,
} from "@tabler/icons-react";
import { PERMS, type PermissionKey } from "@skerp/types";

/**
 * Quick Create — the documents a user starts most often, so the Dashboard can
 * skip the module's list page. Every entry NAVIGATES to the owning creation
 * page; none of these forms is reused in a dialog.
 *
 * LR, receipts and vendor payments are deliberately links rather than drawers:
 * LRForm renders its own CreateTripDialog and a two-column page layout, and
 * receipts and vendor payments are multi-step wizards. None survives being
 * nested in an overlay, and a second copy of any of them would be a second
 * place for validation to drift.
 *
 * Order is the order shown. `primary` marks the single filled button — one per
 * view (design.md §6). The row renders only what the viewer may create, so an
 * accounts user sees Receipt and Vendor Payment and nothing else.
 */
export type CreateAction = {
  label: string;
  href: string;
  icon: Icon;
  permission: PermissionKey;
  /** Shown past the "More" divider rather than inline. */
  overflow?: boolean;
  primary?: boolean;
};

export const CREATE_ACTIONS: CreateAction[] = [
  {
    label: "New LR",
    href: "/lorry-receipts/new",
    icon: IconTruckDelivery,
    permission: PERMS.LORRY_RECEIPT.CREATE,
    primary: true,
  },
  {
    label: "Order",
    href: "/orders/new",
    icon: IconClipboardList,
    permission: PERMS.ORDER.CREATE,
  },
  {
    label: "Trip",
    href: "/trips/new",
    icon: IconRoute,
    permission: PERMS.TRIP.CREATE,
  },
  {
    label: "Receipt",
    href: "/accounts/receipts/new",
    icon: IconReceipt2,
    permission: PERMS.RECEIPT.CREATE,
  },
  {
    label: "Vendor payment",
    href: "/accounts/vendor-payments/new",
    icon: IconFileInvoice,
    permission: PERMS.ACCOUNTS.PAYMENT.CREATE,
    overflow: true,
  },
  {
    label: "Job card",
    href: "/workshop/job-cards/new",
    icon: IconTool,
    permission: PERMS.WORKSHOP.JOBCARD_MANAGE,
    overflow: true,
  },
];
