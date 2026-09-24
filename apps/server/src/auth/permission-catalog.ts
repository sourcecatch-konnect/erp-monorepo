import { db } from "../../prisma/prisma.js";
import { ALL_PERMISSION_KEYS, moduleCodeOf } from "./permissions.js";

/**
 * Syncs the permission registry into `PermissionDef` at boot. This used to be
 * one awaited upsert per key (hundreds of round trips to a remote DB on every
 * restart); it's now one read plus a bulk insert for new keys and an update
 * only for the rare key whose module changed.
 */
export const ensurePermissionCatalog = async (): Promise<void> => {
  const existing = await db.permissionDef.findMany({
    select: { key: true, moduleCode: true },
  });
  const moduleByKey = new Map(existing.map((row) => [row.key, row.moduleCode]));

  const missing = ALL_PERMISSION_KEYS.filter((key) => !moduleByKey.has(key));
  if (missing.length > 0) {
    await db.permissionDef.createMany({
      data: missing.map((key) => ({
        key,
        moduleCode: moduleCodeOf(key),
        description: null,
      })),
      skipDuplicates: true,
    });
  }

  for (const key of ALL_PERMISSION_KEYS) {
    const current = moduleByKey.get(key);
    if (current !== undefined && current !== moduleCodeOf(key)) {
      await db.permissionDef.update({
        where: { key },
        data: { moduleCode: moduleCodeOf(key) },
      });
    }
  }

  await db.permissionDef.updateMany({
    where: { key: { startsWith: "admin." }, isSystem: false },
    data: { isSystem: true },
  });
};
