import { fakeName, fakeAddress } from "../fake/identity";
import { fakeIndianPhone } from "../fake/phone";
import { fakePAN } from "../fake/pan";
import { pick, randInt, randDigits, randAlpha } from "../fake/random";

export type DriverPrefillOptions = {
  states: Array<{ id: string; name: string }>;
  cities: Array<{ id: string; stateId: string; name: string }>;
};

export type DriverFormPrefill = {
  name: string;
  photoPath: string;
  status: "AVAILABLE" | "ON_TRIP";
  type: "Permanent" | "Contract" | "Owner";
  birthDate: string;
  anniversaryDate: string;
  mobile: string;
  alternateMobile: string;
  licenseNo: string;
  licenseDate: string;
  licenseExpiryDate: string;
  licenseCity: string;
  permanentAddress: string;
  permanentCountry: string;
  permanentState: string;
  permanentCity: string;
  correspondenceAddress: string;
  correspondenceCountry: string;
  correspondenceState: string;
  correspondenceCity: string;
  correspondenceLandline: string;
  referencePerson: string;
  referenceContactNo: string;
  bloodGroup: string;
  otherDetails: string;
  salary: string;
  panNo: string;
  aadharCardNo: string;
  noTDSApplyAmount: string;
  tdsRate: string;
  onLeave: boolean;
  blackListed: boolean;
};

const dateInput = (date: Date) => date.toISOString().slice(0, 10);

function randomPastDate(maxDaysAgo: number): Date {
  return new Date(Date.now() - randInt(1, maxDaysAgo) * 24 * 60 * 60 * 1000);
}

function fakeLicenseNo(): string {
  const stateCode = pick([
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
  ]);

  return `${stateCode}${String(randInt(1, 99)).padStart(2, "0")}${randDigits(4)}${randDigits(7)}`;
}

function fakeAadharNo(): string {
  return `${randInt(2, 9)}${randDigits(11)}`;
}

function pickStateCity(opts: DriverPrefillOptions) {
  const state = opts.states.length ? pick(opts.states) : null;
  const cities = state
    ? opts.cities.filter((city) => city.stateId === state.id)
    : opts.cities;
  const city = cities.length ? pick(cities) : null;

  return { state, city };
}

export function prefillDriver(opts: DriverPrefillOptions): DriverFormPrefill {
  const name = fakeName();
  const referencePerson = fakeName();
  const { state: permanentState, city: permanentCity } = pickStateCity(opts);
  const { state: correspondenceState, city: correspondenceCity } = pickStateCity(
    opts
  );

  const birthDate = randomPastDate(16000);
  const anniversaryDate = randomPastDate(12000);
  const licenseDate = randomPastDate(4000);
  const licenseExpiryDate = new Date(
    licenseDate.getTime() + randInt(365, 365 * 10) * 24 * 60 * 60 * 1000
  );

  const salary = randInt(18000, 65000);
  const tdsThreshold = randInt(10000, 50000);

  return {
    name,
    photoPath: "",
    status: pick(["AVAILABLE", "ON_TRIP"]),
    type: pick(["Permanent", "Contract", "Owner"]),
    birthDate: dateInput(birthDate),
    anniversaryDate: dateInput(anniversaryDate),
    mobile: fakeIndianPhone(),
    alternateMobile: fakeIndianPhone(),
    licenseNo: fakeLicenseNo(),
    licenseDate: dateInput(licenseDate),
    licenseExpiryDate: dateInput(licenseExpiryDate),
    licenseCity: permanentCity?.name ?? correspondenceCity?.name ?? "",
    permanentAddress: fakeAddress(),
    permanentCountry: "India",
    permanentState: permanentState?.name ?? "",
    permanentCity: permanentCity?.name ?? "",
    correspondenceAddress: fakeAddress(),
    correspondenceCountry: "India",
    correspondenceState: correspondenceState?.name ?? "",
    correspondenceCity: correspondenceCity?.name ?? "",
    correspondenceLandline: `020-${randDigits(7)}`,
    referencePerson,
    referenceContactNo: fakeIndianPhone(),
    bloodGroup: pick(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
    otherDetails: `Test driver profile for ${name}`,
    salary: String(salary),
    panNo: fakePAN(),
    aadharCardNo: fakeAadharNo(),
    noTDSApplyAmount: String(tdsThreshold),
    tdsRate: String(randInt(1, 10)),
    onLeave: false,
    blackListed: false,
  };
}
