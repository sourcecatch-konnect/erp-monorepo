import { pick, randInt, randDigits, randAlpha } from "../fake/random";

export type VehiclePrefillOptions = {
  vehicleTypes: Array<{ id: string; name: string }>;
};

export type VehicleFormPrefill = {
  vehicleNumber: string;
  chasisNumber: string;
  engineNumber: string;
  ownershipType: "Own_Vehicle" | "Market_Vehicle";
  vehicleTypeId: string;
  capacityMT: string;
  wheels: string;
  bodyType: "HQ" | "LQ" | "";
  lengthFeet: string;
  openingKM: string;
  currentKM: string;
  purchaseDate: string;
  insuranceNumber: string;
  insuranceCompany: string;
  insuranceIssueDate: string;
  insuranceDueDate: string;
  status: "AVAILABLE" | "ON_TRIP";
};

const VEHICLE_STATE_CODES = [
  "MH",
  "GJ",
  "RJ",
  "KA",
  "TN",
  "DL",
  "UP",
  "HR",
  "PB",
  "MP",
];

const dateInput = (date: Date) => date.toISOString().slice(0, 10);

function fakeVehicleNumber(): string {
  const stateCode = pick(VEHICLE_STATE_CODES);
  const rto = String(randInt(1, 99)).padStart(2, "0");
  const series = pick(["A", "AB", "ABC"]);
  const digits = randDigits(4);

  return `${stateCode}${rto}${series}${digits}`;
}

function fakeChasisNumber(): string {
  return `${randAlpha(6)}${randDigits(11)}`;
}

function fakeEngineNumber(): string {
  return `${randAlpha(4)}${randDigits(8)}`;
}

function randomPastDate(maxDaysAgo: number): Date {
  const offset = randInt(1, maxDaysAgo);
  return new Date(Date.now() - offset * 24 * 60 * 60 * 1000);
}

export function prefillVehicle(
  opts: VehiclePrefillOptions
): VehicleFormPrefill {
  const vehicleType = opts.vehicleTypes.length
    ? pick(opts.vehicleTypes)
    : null;

  const openingKM = randInt(0, 150000);
  const currentKM = openingKM + randInt(50, 5000);
  const purchaseDate = randomPastDate(900);
  const insuranceIssueDate = randomPastDate(180);
  const insuranceDueDate = new Date(
    insuranceIssueDate.getTime() + randInt(180, 365) * 24 * 60 * 60 * 1000
  );

  return {
    vehicleNumber: fakeVehicleNumber(),
    chasisNumber: fakeChasisNumber(),
    engineNumber: fakeEngineNumber(),
    ownershipType: pick(["Own_Vehicle", "Market_Vehicle"]),
    vehicleTypeId: vehicleType?.id ?? "",
    capacityMT: String(randInt(6, 40)),
    wheels: pick(["6", "8", "10", "12", "14", "16"]),
    bodyType: pick(["HQ", "LQ", ""]),
    lengthFeet: String(randInt(12, 32)),
    openingKM: String(openingKM),
    currentKM: String(currentKM),
    purchaseDate: dateInput(purchaseDate),
    insuranceNumber: `INS-${randDigits(8)}`,
    insuranceCompany: pick([
      "HDFC ERGO",
      "ICICI Lombard",
      "New India Assurance",
      "United India Insurance",
    ]),
    insuranceIssueDate: dateInput(insuranceIssueDate),
    insuranceDueDate: dateInput(insuranceDueDate),
    status: pick(["AVAILABLE", "ON_TRIP"]),
  };
}
