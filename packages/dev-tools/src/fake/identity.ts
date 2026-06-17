import { pick, randInt } from "./random";

const FIRST_NAMES = [
  "Rahul","Priya","Amit","Sunita","Vikram","Kavitha","Sanjay","Meera",
  "Arjun","Deepika","Ravi","Anita","Suresh","Pooja","Kiran","Neha",
];

const LAST_NAMES = [
  "Sharma","Patel","Singh","Reddy","Kumar","Nair","Gupta","Joshi",
  "Mehta","Iyer","Rao","Verma","Mishra","Pillai","Shah","Bhat",
];

const COMPANY_SUFFIXES = [
  "Enterprises","Logistics","Traders","Industries","Pvt Ltd","Solutions","Group",
];

const COMPANY_ROOTS = [
  "Shree","Sri","Bharat","Hindustan","National","Global","Prime","Royal","Apex","Star",
];

const CITIES_FOR_EMAIL = ["mumbai","delhi","pune","chennai","bangalore","hyderabad"];

export function fakeName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

export function fakeCompanyName(): string {
  return `${pick(COMPANY_ROOTS)} ${pick(LAST_NAMES)} ${pick(COMPANY_SUFFIXES)}`;
}

export function fakeShortName(full: string): string {
  return full.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 6);
}

export function fakeEmail(name: string): string {
  const slug = name.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z.]/g, "");
  const city = pick(CITIES_FOR_EMAIL);
  const n = randInt(1, 999);
  return `${slug}${n}@${city}mail.com`;
}

export function fakeWebsite(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  return `https://www.${slug}.com`;
}

const STREET_TYPES = ["Nagar","Colony","Road","Marg","Layout","Industrial Area","Sector"];
const AREA_NAMES = ["MG","Gandhi","Nehru","Patel","Lal Bahadur","Subhash","Anna","Rajaji"];

export function fakeAddress(): string {
  const num = randInt(1, 999);
  const area = pick(AREA_NAMES);
  const type = pick(STREET_TYPES);
  return `${num}, ${area} ${type}`;
}
