import {
  ALL_PERMISSION_KEYS,
  permissionAreaLabel,
  permissionAreaOf,
  permissionLabel,
} from "@skerp/types";
import type { PermissionPageQuery } from "@skerp/validators";
import type { Prisma } from "../../../generated/prisma/index.js";

export function permissionPageOptions(query: PermissionPageQuery) {
  const words = (query.search ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const matchingKeys = words.length
    ? ALL_PERMISSION_KEYS.filter((key) => {
        const label =
          `${permissionLabel(key)} ${permissionAreaLabel(permissionAreaOf(key))}`.toLowerCase();
        return words.every((word) => label.includes(word));
      })
    : [];
  const where: Prisma.PermissionDefWhereInput = {
    ...(query.moduleCode
      ? {
          moduleCode:
            query.moduleCode === "masters"
              ? { startsWith: "masters." }
              : query.moduleCode,
        }
      : {}),
    ...(words.length
      ? {
          OR: [
            { key: { in: [...matchingKeys] } },
            {
              AND: words.map((word) => ({
                description: { contains: word, mode: "insensitive" as const },
              })),
            },
          ],
        }
      : {}),
  };
  return {
    where,
    skip: query.page * query.size,
    take: query.size,
    orderBy: [{ moduleCode: "asc" as const }, { key: "asc" as const }],
  };
}
