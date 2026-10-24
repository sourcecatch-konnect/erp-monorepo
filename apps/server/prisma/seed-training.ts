import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./prisma.js";
import { seedLedger } from "./seed-ledger.js";

/**
 * A9 — demo data for the TRAINING environment only.
 *
 * Everything here is made up ("Demo Appliances Ltd", "Demo Pune", vehicle
 * MH19TR0001…) so practice can never be confused with real business.
 * Safe to run more than once: each record is looked up before it is created.
 * It holds every master a practice mission needs, because the nightly reset
 * wipes anything added by hand.
 *
 * Run after seed-admin.ts (it needs the company and the canonical roles):
 *   APP_ENVIRONMENT=training TRAINING_DEMO_PASSWORD=… pnpm training:seed
 *
 * Refuses to run unless APP_ENVIRONMENT=training, so demo data can't end up
 * in a real database by accident.
 */

if (process.env.APP_ENVIRONMENT !== "training") {
  console.error(
    "seed-training: refusing to run. Set APP_ENVIRONMENT=training (training environment only).",
  );
  process.exit(1);
}

const DEMO_PASSWORD = process.env.TRAINING_DEMO_PASSWORD;
if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 8) {
  console.error(
    "seed-training: set TRAINING_DEMO_PASSWORD (8+ characters) — the password every demo user signs in with.",
  );
  process.exit(1);
}

const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function state(name: string) {
  return (
    (await db.state.findFirst({ where: { name } })) ??
    (await db.state.create({ data: { name } }))
  );
}

async function city(name: string, stateId: string) {
  return (
    (await db.city.findFirst({ where: { name, stateId } })) ??
    (await db.city.create({ data: { name, stateId } }))
  );
}

async function branch(branchCode: string, name: string, cityId: string, companyId: string) {
  return (
    (await db.branch.findFirst({ where: { branchCode } })) ??
    (await db.branch.create({ data: { branchCode, name, cityId, companyId } }))
  );
}

async function main() {
  const company = await db.company.findFirst({ where: { name: "SK Translines" } });
  if (!company) {
    throw new Error("Run seed-admin.ts first — the company and roles must exist.");
  }

  /* ---- Places ---- */
  const maharashtra = await state("Maharashtra");
  const assam = await state("Assam");
  const pune = await city("Pune", maharashtra.id);
  const jalgaon = await city("Jalgaon", maharashtra.id);
  const guwahati = await city("Guwahati", assam.id);

  const demoPune = await branch("TRN-PUN", "Demo Pune", pune.id, company.id);
  const demoJalgaon = await branch("TRN-JAL", "Demo Jalgaon", jalgaon.id, company.id);
  const demoGuwahati = await branch("TRN-GHY", "Demo Guwahati", guwahati.id, company.id);
  const demoBranches = [demoPune, demoJalgaon, demoGuwahati];

  /* ---- Head office: every vehicle journey starts here ---- */
  // Exactly one branch may be the head office. A fresh training database has
  // none, so Demo Pune takes the role: a trip from Pune then opens its journey
  // without needing the chain-override permission.
  if (!(await db.branch.findFirst({ where: { isHeadOffice: true } }))) {
    await db.branch.update({ where: { id: demoPune.id }, data: { isHeadOffice: true } });
  }

  /* ---- Rail heads, so LRs can go Road & Rail ---- */
  const railHead = async (name: string, cityId: string, branchId: string) => {
    const area = await db.area.upsert({
      where: { cityId_name: { cityId, name } },
      create: { name, cityId, isRailHead: true },
      update: { isRailHead: true },
    });
    await db.branchRailheadArea.upsert({
      where: { branchId_areaId: { branchId, areaId: area.id } },
      create: { branchId, areaId: area.id },
      update: { isActive: true },
    });
    await db.branch.update({ where: { id: branchId }, data: { isRailHead: true } });
    return area;
  };
  const puneRailHead = await railHead("Demo Pune Rail Head", pune.id, demoPune.id);
  const guwahatiRailHead = await railHead("Demo Guwahati Rail Head", guwahati.id, demoGuwahati.id);

  /* ---- Customers + their locations ---- */
  const appliances =
    (await db.customer.findFirst({ where: { name: "Demo Appliances Ltd" } })) ??
    (await db.customer.create({
      data: { name: "Demo Appliances Ltd", cityId: pune.id, stateId: maharashtra.id },
    }));
  const foods =
    (await db.customer.findFirst({ where: { name: "Demo Foods Pvt Ltd" } })) ??
    (await db.customer.create({
      data: { name: "Demo Foods Pvt Ltd", cityId: jalgaon.id, stateId: maharashtra.id },
    }));

  const locations: { customerId: string; name: string; cityId: string }[] = [
    { customerId: appliances.id, name: "Demo Appliances — Pune Warehouse", cityId: pune.id },
    { customerId: appliances.id, name: "Demo Appliances — Guwahati Depot", cityId: guwahati.id },
    { customerId: foods.id, name: "Demo Foods — Jalgaon Factory", cityId: jalgaon.id },
  ];
  for (const location of locations) {
    const exists = await db.customerLocation.findFirst({
      where: { customerId: location.customerId, name: location.name },
    });
    if (!exists) await db.customerLocation.create({ data: location });
  }

  /* ---- Routes ---- */
  const route = async (sourceCityId: string, destinationCityId: string) =>
    (await db.route.findFirst({ where: { sourceCityId, destinationCityId } })) ??
    (await db.route.create({ data: { sourceCityId, destinationCityId } }));
  const puneToGuwahati = await route(pune.id, guwahati.id);
  await route(jalgaon.id, pune.id);

  /* ---- Goods, units, vehicle type ---- */
  if (!(await db.unitOfMeasure.findFirst({ where: { code: "BOX" } }))) {
    await db.unitOfMeasure.create({ data: { code: "BOX", name: "Box", category: "PACKAGING" } });
  }
  const goods: {
    name: string;
    category: "Heavy" | "Light";
    storagePosition: "Any" | "Horizontal" | "Vertical";
    storageLayer: "Both" | "Bottom" | "Upper";
  }[] = [
    { name: "Demo Refrigerators", category: "Heavy", storagePosition: "Vertical", storageLayer: "Bottom" },
    { name: "Demo Biscuits", category: "Light", storagePosition: "Any", storageLayer: "Both" },
  ];
  for (const item of goods) {
    if (!(await db.goods.findFirst({ where: { name: item.name } }))) {
      await db.goods.create({ data: item });
    }
  }

  const truckType =
    (await db.vehicleType.findFirst({ where: { code: "32HQ" } })) ??
    (await db.vehicleType.create({ data: { code: "32HQ", name: "32 ft HQ container" } }));

  /* ---- Vehicles + drivers ---- */
  const vehicles: {
    vehicleNumber: string;
    ownershipType: "Own_Vehicle" | "Market_Vehicle";
  }[] = [
    { vehicleNumber: "MH19TR0001", ownershipType: "Own_Vehicle" },
    { vehicleNumber: "MH12TR0002", ownershipType: "Market_Vehicle" },
  ];
  for (const vehicle of vehicles) {
    if (!(await db.vehicle.findFirst({ where: { vehicleNumber: vehicle.vehicleNumber } }))) {
      await db.vehicle.create({
        data: {
          ...vehicle,
          capacityMT: 18,
          currentKM: 120_000,
          openingKM: 120_000,
          vehicleTypeId: truckType.id,
        },
      });
    }
  }
  for (const driver of [
    { name: "Demo Driver Ramesh", type: "Permanent" },
    { name: "Demo Driver Suresh", type: "Contract" },
  ]) {
    if (!(await db.driver.findFirst({ where: { name: driver.name } }))) {
      await db.driver.create({ data: driver });
    }
  }

  /* ---- Agreement + rate, so a demo order gets its freight ---- */
  const agreement =
    (await db.agreement.findFirst({ where: { clientId: appliances.id, companyId: company.id } })) ??
    (await db.agreement.create({
      data: {
        companyId: company.id,
        clientId: appliances.id,
        startDate: days(-30),
        agreementDate: days(-30),
        expiryDate: days(365),
        leadGeneratedByBranchId: demoPune.id,
        cityId: pune.id,
      },
    }));
  const rateExists = await db.rateMatrix.findFirst({
    where: {
      agreementId: agreement.id,
      routeId: puneToGuwahati.id,
      vehicleTypeId: truckType.id,
      transportType: "ROAD",
    },
  });
  if (!rateExists) {
    await db.rateMatrix.create({
      data: {
        agreementId: agreement.id,
        routeId: puneToGuwahati.id,
        vehicleTypeId: truckType.id,
        transportType: "ROAD",
        rate: 14_000_000n, // ₹1,40,000 in paise — the example from the SOP
        transitDays: 6,
        remarks: "Demo rate for training",
      },
    });
  }

  /* ---- Wagon + railway freight, so a VP schedule can be planned ---- */
  const wagon = await db.wagon.upsert({
    where: { name: "Demo BCN Wagon" },
    create: {
      name: "Demo BCN Wagon",
      height: 3.2,
      width: 2.9,
      weight: 22.5,
      totalCft: 4_600,
      capacityMt: 58,
    },
    update: { isActive: true },
  });
  const railFreightExists = await db.railwayFreightMatrix.findFirst({
    where: {
      wagonId: wagon.id,
      sourceAreaId: puneRailHead.id,
      destinationAreaId: guwahatiRailHead.id,
    },
  });
  if (!railFreightExists) {
    await db.railwayFreightMatrix.create({
      data: {
        wagonId: wagon.id,
        sourceCityId: pune.id,
        destinationCityId: guwahati.id,
        sourceAreaId: puneRailHead.id,
        destinationAreaId: guwahatiRailHead.id,
        freightAmount: 18_500_000n, // ₹1,85,000 per wagon, in paise
      },
    });
  }

  /* ---- Workshop: a supplier and a part to order ---- */
  const spareCategory =
    (await db.spareCategory.findFirst({ where: { name: "Demo Brakes" } })) ??
    (await db.spareCategory.create({ data: { name: "Demo Brakes", type: "Item" } }));
  const spareSupplier =
    (await db.sparePartSupplier.findFirst({ where: { name: "Demo Auto Spares" } })) ??
    (await db.sparePartSupplier.create({
      data: { name: "Demo Auto Spares", type: "Item", shopName: "Demo Auto Spares", cityId: pune.id },
    }));
  if (!(await db.sparePart.findFirst({ where: { name: "Demo Brake Pads" } }))) {
    await db.sparePart.create({
      data: {
        name: "Demo Brake Pads",
        type: "Item",
        categoryId: spareCategory.id,
        supplierId: spareSupplier.id,
        rate: 250_000n, // ₹2,500 a set, in paise
        minimumStock: 4,
        unit: "Set",
      },
    });
  }

  /* ---- Bank + cash accounts, then the chart of accounts ---- */
  // Bills and receipts post to the ledger, which needs the GL heads from
  // seed-ledger.ts and a ledger per cash account.
  for (const account of [
    { name: "Demo Bank Account", type: "BANK" as const, bankName: "Demo Bank", accountLast4: "0001" },
    { name: "Demo Cash", type: "CASH" as const },
  ]) {
    if (!(await db.cashAccount.findFirst({ where: { name: account.name, deletedAt: null } }))) {
      await db.cashAccount.create({ data: account });
    }
  }
  await seedLedger(db);

  /* ---- One demo user per canonical role ---- */
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD!, 10);
  const trainees: {
    userName: string;
    firstName: string;
    role: string;
    branchScope: "ALL" | "ASSIGNED";
  }[] = [
    { userName: "trainee.ops", firstName: "Operations", role: "Operations", branchScope: "ASSIGNED" },
    { userName: "trainee.manager", firstName: "Manager", role: "Branch Manager", branchScope: "ASSIGNED" },
    { userName: "trainee.accounts", firstName: "Accounts", role: "Accounts", branchScope: "ALL" },
    { userName: "trainee.auditor", firstName: "Auditor", role: "Read-Only Auditor", branchScope: "ALL" },
    { userName: "trainee.admin", firstName: "Admin", role: "Admin", branchScope: "ALL" },
  ];
  for (const trainee of trainees) {
    const role = await db.role.findFirst({ where: { name: trainee.role } });
    if (!role) {
      console.warn(`seed-training: role "${trainee.role}" not found, skipping ${trainee.userName}`);
      continue;
    }
    const email = `${trainee.userName}@training.local`;
    const data = {
      userName: trainee.userName,
      firstName: trainee.firstName,
      lastName: "Trainee",
      email,
      companyId: company.id,
      branchId: demoPune.id,
      roleId: role.id,
      status: true,
      password: passwordHash,
      branchScope: trainee.branchScope,
    };
    const user = await db.user.upsert({
      where: { email },
      create: data,
      update: { password: passwordHash, roleId: role.id, status: true, branchScope: trainee.branchScope },
    });
    if (trainee.branchScope === "ASSIGNED") {
      await db.userBranch.createMany({
        data: demoBranches.map((b) => ({ userId: user.id, branchId: b.id })),
        skipDuplicates: true,
      });
    }
  }

  console.log(
    `seed-training: demo data ready — ${trainees.length} trainee users (password from TRAINING_DEMO_PASSWORD), ` +
      `3 demo branches (Demo Pune is head office), 2 rail heads, 2 customers, 2 vehicles, 2 drivers, ` +
      `1 road rate, 1 wagon + rail freight, 1 workshop supplier + part, 2 cash accounts, chart of accounts.`,
  );
}

main()
  .catch((error) => {
    console.error("seed-training failed:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
