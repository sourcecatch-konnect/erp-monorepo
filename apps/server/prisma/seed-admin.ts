import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./prisma.js";

/**
 * Idempotent admin seed.
 * A User requires a Company, Branch and Role, so this creates the minimal
 * chain (Company -> Branch -> Role -> User) needed for admin login.
 *
 * Run from apps/server:  pnpm exec tsx prisma/seed-admin.ts
 */
const ADMIN_EMAIL = "admin@sktranslines.com";
const ADMIN_PASSWORD = "Admin@123";
const MASTER_MODULES = [
  { code: "masters.state", name: "State Master" },
  { code: "masters.city", name: "City Master" },
  { code: "masters.area", name: "Area Master" },
  { code: "masters.transport", name: "Transport Master" },
  { code: "masters.vehicle", name: "Vehicle Master" },
  { code: "masters.driver", name: "Driver Master" },
  { code: "masters.spare-category", name: "Spare Category Master" },
  { code: "masters.spare-part", name: "Spare Part Master" },
  { code: "masters.spare-part-supplier", name: "Spare Part Supplier Master" },
  { code: "masters.customer", name: "Customer Master" },
  { code: "masters.company", name: "Company Master" },
  { code: "masters.branch", name: "Branch Master" },
  { code: "masters.route", name: "Route Master" },
  { code: "masters.warehouse", name: "Warehouse Master" },
  { code: "masters.labour", name: "Labour Master" },
  { code: "masters.goods", name: "Goods Master" },
  { code: "masters.pump", name: "Pump Master" },
  { code: "masters.wagon", name: "Wagon Master" },
  { code: "masters.railwayFreightMatrix", name: "Railway Freight Matrix Master" },
  { code: "masters.agreement", name: "Agreement Master" },
  { code: "masters.rate-matrix", name: "Rate Matrix Master" },
];

async function main() {
  // 1. Company
  let company = await db.company.findFirst({
    where: { name: "SK Translines" },
  });
  const state = await db.state.upsert({
    where: { name: "Maharashtra" },
    update: {},
    create: { name: "Maharashtra" },
  });

  let city = await db.city.findFirst({
    where: {
      name: "Mumbai",
      stateId: state.id,
    },
  });

  if (!city) {
    city = await db.city.create({
      data: {
        name: "Mumbai",
        stateId: state.id,
      },
    });
  }
  if (!company) {
    company = await db.company.create({
  data: {
    name: "SK Translines",
    country: "India",
    stateId: state.id,
    cityId: city.id,
    establishmentYear: new Date("2010-01-01"),
  },
});
    console.log("Created company:", company.name);
  }

  // 2. Branch
  let branch = await db.branch.findFirst({
    where: { branchCode: "HO" },
  });
  if (!branch) {
   branch = await db.branch.create({
  data: {
    branchCode: "HO",
    shortCode: "HO",
    name: "Head Office",
    cityId: city.id,
    companyId: company.id,
  },
});
    console.log("Created branch:", branch.name);
  }

  // 3. Role (Role.name is not unique, so look it up explicitly)
  let role = await db.role.findFirst({ where: { name: "Admin" } });
  if (!role) {
    role = await db.role.create({ data: { name: "Admin" } });
    console.log("Created role:", role.name);
  }

  for (const moduleDef of MASTER_MODULES) {
    const module = await db.module.upsert({
      where: { code: moduleDef.code },
      update: { name: moduleDef.name },
      create: moduleDef,
    });

    await db.permission.upsert({
      where: {
        roleId_moduleId: {
          roleId: role.id,
          moduleId: module.id,
        },
      },
      update: {
        canView: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      },
      create: {
        roleId: role.id,
        moduleId: module.id,
        canView: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      },
    });
  }

  // 4. Admin user
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const existing = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existing) {
    await db.user.update({
      where: { email: ADMIN_EMAIL },
      data: { password: passwordHash, roleId: role.id, status: true },
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
        roleId: role.id,
        status: true,
        password: passwordHash,
      },
    });
    console.log("Created admin user.");
  }

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
