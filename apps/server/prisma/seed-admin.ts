import "dotenv/config";
import bcrypt from "bcryptjs";
import { ALL_PERMISSION_KEYS, PERMS, moduleCodeOf, type PermissionKey } from "@skerp/types";
import { db } from "./prisma.js";

/**
 * Idempotent admin + RBAC seed.
 *
 * Creates the minimum chain (Company -> Branch -> Role -> User) plus the
 * Phase 1 RBAC catalog:
 *   - PermissionDef rows synced from ALL_PERMISSION_KEYS
 *   - Canonical roles (Admin / Branch Manager / Operations / Accounts /
 *     Read-Only Auditor) with their RolePermission grants
 *   - Admin is marked isSystem so the UI can prevent edits/deletes
 *   - Existing users get a UserBranch row mirroring their primary branchId
 *
 * Run from apps/server:  pnpm exec tsx prisma/seed-admin.ts
 */
const ADMIN_EMAIL = "admin@sktranslines.com";
const ADMIN_PASSWORD = "Admin@123";

const RM = PERMS.MASTERS;

const allMasterKeys = (
  m: (typeof RM)[keyof typeof RM],
): PermissionKey[] => Object.values(m) as PermissionKey[];

const masterViewKeys = (m: typeof RM[keyof typeof RM]): PermissionKey[] => [m.VIEW];

const ALL_MASTER_KEYS_FLAT: PermissionKey[] = Object.values(RM).flatMap(allMasterKeys);
const ALL_MASTER_VIEW_KEYS: PermissionKey[] = Object.values(RM).flatMap(masterViewKeys);

/**
 * Canonical roles. Permission set is computed against the registry, so as
 * new permission keys are added the seed automatically grants them to the
 * Admin role (and any other role explicitly opting into "*").
 */
const CANONICAL_ROLES: {
  name: string;
  isSystem: boolean;
  permissions: PermissionKey[] | "*";
}[] = [
  { name: "Admin", isSystem: true, permissions: "*" },
  {
    name: "Branch Manager",
    isSystem: false,
    permissions: [
      ...ALL_MASTER_KEYS_FLAT,
      PERMS.LORRY_RECEIPT.VIEW,
      PERMS.LORRY_RECEIPT.CREATE,
      PERMS.LORRY_RECEIPT.UPDATE,
      PERMS.LORRY_RECEIPT.APPROVE,
      PERMS.LORRY_RECEIPT.CANCEL,
      PERMS.LORRY_RECEIPT.DELIVER,
      PERMS.LORRY_RECEIPT.ACKNOWLEDGE,
      PERMS.TRIP.VIEW,
      PERMS.TRIP.CREATE,
      PERMS.TRIP.UPDATE,
      PERMS.TRIP.CLOSE,
      PERMS.TRIP.CANCEL,
      PERMS.VEHICLE_JOURNEY.VIEW,
      PERMS.VEHICLE_JOURNEY.CREATE,
      PERMS.VEHICLE_JOURNEY.UPDATE,
      PERMS.VEHICLE_JOURNEY.CLOSE,
      PERMS.VEHICLE_JOURNEY.CANCEL,
      PERMS.VEHICLE_JOURNEY.OVERRIDE_CHAIN,
      PERMS.TRIP_EXPENSE.VIEW,
      PERMS.TRIP_EXPENSE.CREATE,
      PERMS.TRIP_EXPENSE.UPDATE,
      PERMS.TRIP_EXPENSE.APPROVE,
      PERMS.TRIP_ADVANCE.VIEW,
      PERMS.TRIP_ADVANCE.CREATE,
      PERMS.LOGSLIP.VIEW,
      PERMS.LOGSLIP.PRINT,
      PERMS.ORDER.VIEW,
      PERMS.ORDER.CREATE,
      PERMS.ORDER.UPDATE,
      PERMS.ORDER.APPROVE,
      PERMS.ORDER.REJECT,
      PERMS.ORDER.CANCEL,
      PERMS.EWAYBILL.VIEW,
      PERMS.EWAYBILL.CREATE,
      PERMS.EWAYBILL.UPDATE,
      PERMS.EWAYBILL.EXTEND,
      PERMS.EWAYBILL.CANCEL,
      PERMS.ATTACHMENTS.VIEW,
      PERMS.ATTACHMENTS.CREATE,
      PERMS.ATTACHMENTS.DOWNLOAD,
      PERMS.ATTACHMENTS.DELETE,
    ],
  },
  {
    name: "Operations",
    isSystem: false,
    permissions: [
      ...ALL_MASTER_VIEW_KEYS,
      PERMS.LORRY_RECEIPT.VIEW,
      PERMS.LORRY_RECEIPT.CREATE,
      PERMS.LORRY_RECEIPT.UPDATE,
      PERMS.LORRY_RECEIPT.DELIVER,
      PERMS.TRIP.VIEW,
      PERMS.TRIP.CREATE,
      PERMS.TRIP.UPDATE,
      PERMS.VEHICLE_JOURNEY.VIEW,
      PERMS.VEHICLE_JOURNEY.CREATE,
      PERMS.VEHICLE_JOURNEY.UPDATE,
      PERMS.VEHICLE_JOURNEY.CLOSE,
      PERMS.TRIP_EXPENSE.VIEW,
      PERMS.TRIP_EXPENSE.CREATE,
      PERMS.TRIP_EXPENSE.UPDATE,
      PERMS.TRIP_ADVANCE.VIEW,
      PERMS.TRIP_ADVANCE.CREATE,
      PERMS.LOGSLIP.VIEW,
      PERMS.ORDER.VIEW,
      PERMS.ORDER.CREATE,
      PERMS.ORDER.UPDATE,
      PERMS.EWAYBILL.VIEW,
      PERMS.EWAYBILL.CREATE,
      PERMS.EWAYBILL.UPDATE,
      PERMS.ATTACHMENTS.VIEW,
      PERMS.ATTACHMENTS.CREATE,
      PERMS.ATTACHMENTS.DOWNLOAD,
    ],
  },
  {
    name: "Accounts",
    isSystem: false,
    permissions: [
      ...ALL_MASTER_VIEW_KEYS,
      ...allMasterKeys(RM.CREDITOR),
      ...allMasterKeys(RM.CASH_ACCOUNT),
      PERMS.LORRY_RECEIPT.VIEW,
      PERMS.LORRY_RECEIPT.GENERATE_INVOICE,
      PERMS.LORRY_RECEIPT.ACKNOWLEDGE,
      PERMS.TRIP.VIEW,
      PERMS.VEHICLE_JOURNEY.VIEW,
      PERMS.TRIP_EXPENSE.VIEW,
      PERMS.TRIP_EXPENSE.APPROVE,
      PERMS.TRIP_EXPENSE.REVERSE,
      PERMS.TRIP_ADVANCE.VIEW,
      PERMS.TRIP_ADVANCE.REVERSE,
      PERMS.LOGSLIP.VIEW,
      PERMS.LOGSLIP.GENERATE,
      PERMS.LOGSLIP.POST_ACCOUNTS,
      PERMS.LOGSLIP.PRINT,
      PERMS.ORDER.VIEW,
      PERMS.EWAYBILL.VIEW,
      PERMS.CASH_PLANNING.VIEW,
      PERMS.CASH_PLANNING.ENTER,
      PERMS.CASH_PLANNING.APPROVE,
      PERMS.CASH_PLANNING.CLOSE,
      PERMS.ATTACHMENTS.VIEW,
      PERMS.ATTACHMENTS.DOWNLOAD,
    ],
  },
  {
    name: "Read-Only Auditor",
    isSystem: false,
    permissions: [
      ...ALL_MASTER_VIEW_KEYS,
      PERMS.LORRY_RECEIPT.VIEW,
      PERMS.TRIP.VIEW,
      PERMS.VEHICLE_JOURNEY.VIEW,
      PERMS.TRIP_EXPENSE.VIEW,
      PERMS.TRIP_ADVANCE.VIEW,
      PERMS.LOGSLIP.VIEW,
      PERMS.ORDER.VIEW,
      PERMS.EWAYBILL.VIEW,
      PERMS.ADMIN.AUDIT_LOG_VIEW,
      PERMS.ATTACHMENTS.VIEW,
      PERMS.ATTACHMENTS.DOWNLOAD,
    ],
  },
];

async function syncPermissionCatalog(): Promise<Map<string, string>> {
  const keyToId = new Map<string, string>();
  for (const key of ALL_PERMISSION_KEYS) {
    const moduleCode = moduleCodeOf(key);
    const row = await db.permissionDef.upsert({
      where: { key },
      update: { moduleCode },
      create: { key, moduleCode, description: null, isSystem: false },
    });
    keyToId.set(key, row.id);
  }
  // Mark admin.* permissions as isSystem so the UI can render them as
  // protected (admins still grant them, but a typo seed pass won't unmark).
  await db.permissionDef.updateMany({
    where: { key: { startsWith: "admin." } },
    data: { isSystem: true },
  });
  console.log(`Synced ${keyToId.size} permission keys.`);
  return keyToId;
}

async function syncCanonicalRoles(keyToId: Map<string, string>) {
  for (const r of CANONICAL_ROLES) {
    let role = await db.role.findFirst({ where: { name: r.name } });
    if (!role) {
      role = await db.role.create({
        data: { name: r.name, isSystem: r.isSystem },
      });
      console.log(`Created role: ${role.name}`);
    } else if (role.isSystem !== r.isSystem) {
      role = await db.role.update({
        where: { id: role.id },
        data: { isSystem: r.isSystem },
      });
    }

    const desiredKeys =
      r.permissions === "*" ? Array.from(keyToId.keys()) : r.permissions;

    const desiredIds = new Set(
      desiredKeys
        .map((k) => keyToId.get(k))
        .filter((v): v is string => Boolean(v))
    );

    const existing = await db.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionId: true },
    });
    const existingIds = new Set(existing.map((e) => e.permissionId));

    const toCreate = [...desiredIds].filter((id) => !existingIds.has(id));
    const toDelete = [...existingIds].filter((id) => !desiredIds.has(id));

    if (toCreate.length) {
      await db.rolePermission.createMany({
        data: toCreate.map((permissionId) => ({
          roleId: role!.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }
    if (toDelete.length && !r.isSystem) {
      // Never strip permissions from a system role implicitly — only add.
      await db.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { in: toDelete } },
      });
    }

    console.log(
      `Role ${role.name}: +${toCreate.length} permissions, ` +
        `${r.isSystem ? "(system, no removals)" : `-${toDelete.length}`}`
    );
  }
}

async function backfillUserBranches() {
  // Mirror User.branchId into UserBranch for existing users so branch-scoped
  // queries continue to work after Phase 3 lands.
  const users = await db.user.findMany({
    select: { id: true, branchId: true },
  });
  for (const u of users) {
    if (!u.branchId) continue;
    await db.userBranch.upsert({
      where: { userId_branchId: { userId: u.id, branchId: u.branchId } },
      update: {},
      create: { userId: u.id, branchId: u.branchId },
    });
  }
  if (users.length) {
    console.log(`Mirrored ${users.length} user(s) into UserBranch.`);
  }
}

async function main() {
  // 1. Company
  let company = await db.company.findFirst({
    where: { name: "SK Translines" },
  });
  const state = await db.state.findFirst({
    where: { name: "Maharashtra" },
  });
  const city = await db.city.findFirst({
    where: { name: "Mumbai" },
  });
  if (!company) {
    company = await db.company.create({
      data: {
        name: "SK Translines",
        country: "India",
        stateId: state!.id,
        cityId: city!.id,
        establishmentYear: new Date("2010-01-01"),
      },
    });
    console.log("Created company:", company.name);
  }

  // 2. Branch
  let branch = await db.branch.findFirst({ where: { branchCode: "HO" } });
  if (!branch) {
    branch = await db.branch.create({
      data: {
        branchCode: "HO",
     
        name: "Head Office",
        cityId: city!.id,
        companyId: company.id,
      },
    });
    console.log("Created branch:", branch.name);
  }

  // 3. Permission catalog + canonical roles
  const keyToId = await syncPermissionCatalog();
  await syncCanonicalRoles(keyToId);

  const adminRole = await db.role.findFirstOrThrow({ where: { name: "Admin" } });

  // 4. Admin user
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const existing = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existing) {
    await db.user.update({
      where: { email: ADMIN_EMAIL },
      data: {
        password: passwordHash,
        roleId: adminRole.id,
        status: true,
        branchScope: "ALL",
      },
    });
    console.log("Updated existing admin user.");
  } else {
    await db.user.create({
      data: {
        userName: "admin",
        firstName: "System",
        lastName: "Admin",
        email: ADMIN_EMAIL,
        companyId: company.id,
        branchId: branch.id,
        roleId: adminRole.id,
        status: true,
        password: passwordHash,
        branchScope: "ALL",
      },
    });
    console.log("Created admin user.");
  }

  // 5. UserBranch backfill
  await backfillUserBranches();

  console.log("\n=== Admin credentials ===");
  console.log("  Email:    " + ADMIN_EMAIL);
  console.log("  Password: " + ADMIN_PASSWORD);
  console.log("=========================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
