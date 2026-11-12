import type { Prisma } from "../../../generated/prisma/index.js";

/** Keep list payload independent of growing part/service histories. */
export const jobCardListSelect = {
  id: true,
  jobCardNumber: true,
  inDateTime: true,
  status: true,
  totalAmountPaise: true,
  vehicle: { select: { id: true, vehicleNumber: true } },
  driver: { select: { id: true, name: true } },
} satisfies Prisma.JobCardSelect;

export function jobCardListWhere(
  scope: Prisma.JobCardWhereInput,
  query: {
    branchId?: string;
    vehicleId?: string;
    status?: "DRAFT" | "FINALISED" | "CANCELLED";
    search?: string;
  },
): Prisma.JobCardWhereInput {
  return {
    // AND prevents a requested branch from overwriting assigned branch scope.
    AND: [
      scope,
      {
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                {
                  jobCardNumber: {
                    contains: query.search,
                    mode: "insensitive",
                  },
                },
                {
                  vehicle: {
                    vehicleNumber: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                },
                {
                  driver: {
                    name: { contains: query.search, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      },
    ],
  };
}
