import { db } from "../../prisma/prisma.js";
import { ALL_PERMISSION_KEYS, moduleCodeOf } from "./permissions.js";

export const ensurePermissionCatalog = async (): Promise<void> => {
  for (const key of ALL_PERMISSION_KEYS) {
    await db.permissionDef.upsert({
      where: { key },
      update: { moduleCode: moduleCodeOf(key) },
      create: { key, moduleCode: moduleCodeOf(key), description: null },
    });
  }

  await db.permissionDef.updateMany({
    where: { key: { startsWith: "admin." } },
    data: { isSystem: true },
  });
};
