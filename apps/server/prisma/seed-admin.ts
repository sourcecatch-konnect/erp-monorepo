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

async function main() {
  // 1. Company
  let company = await db.company.findFirst({
    where: { name: "SK Translines" },
  });
  let state = await db.state.findFirst({
  where: { name: "Maharashtra" },
});

let city = await db.city.findFirst({
  where: { name: "Mumbai" },
});
  if (!company) {
    company = await db.company.create({
  data: {
    name: "SK Translines",
    country: "India",
    state: {
      connect: { id: state!.id },
    },
    city: {
      connect: { id: city!.id },
    },
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

    city: {
      connect: { id: city!.id },
    },

    company: {
      connect: { id: company.id },
    },
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
