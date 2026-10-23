import type { VendorPaymentSlipListFilters } from "@skerp/validators";
import type { Prisma } from "../../../generated/prisma/index.js";

/**
 * Deterministic order for the slip list. `createdAt` alone isn't unique, and
 * the queue pages with offset chunks ("load more") — without the `id`
 * tiebreak, rows sharing a timestamp can be repeated or skipped between
 * consecutive chunks.
 */
export const SLIP_LIST_ORDER_BY: Prisma.VendorPaymentSlipOrderByWithRelationInput[] =
  [{ createdAt: "desc" }, { id: "desc" }];

/**
 * `scope` is the caller's branch filter and always applies. `search` is matched
 * in the database (case-insensitive) against the slip number and the vendor
 * name, so the browser never has to hold the full list to filter it.
 */
export const buildSlipListWhere = (
  filters: VendorPaymentSlipListFilters,
  scope: Prisma.VendorPaymentSlipWhereInput,
): Prisma.VendorPaymentSlipWhereInput => {
  const search = filters.search?.trim();
  return {
    ...scope,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status?.length ? { status: { in: filters.status } } : {}),
    ...(search
      ? {
          OR: [
            { slipNumber: { contains: search, mode: "insensitive" } },
            { transport: { name: { contains: search, mode: "insensitive" } } },
            { labour: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
};
