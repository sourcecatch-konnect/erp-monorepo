import { db } from "../../../prisma/prisma.js";

/**
 * Minimal read-only lookups for form dropdowns (admin-only).
 * The Masters module will later own full Company/Branch CRUD.
 */
export const listCompaniesService = async () => {
  return db.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
};

export const listBranchesService = async (companyId?: string) => {
  return db.branch.findMany({
    where: companyId ? { companyId } : undefined,
    select: { id: true, name: true, companyId: true },
    orderBy: { name: "asc" },
  });
};
