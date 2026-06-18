import { fakePAN } from "../fake/pan";
import { fakeGSTIN } from "../fake/gstin";
import { fakeIndianPhone } from "../fake/phone";
import { fakeCompanyName, fakeShortName, fakeEmail, fakeWebsite, fakeAddress, fakeName } from "../fake/identity";
import { randInt } from "../fake/random";

export type CustomerPrefillOptions = {
  /** Pass the live list so we can pick a real stateId */
  states: Array<{ id: string; name: string }>;
  /** Pass the live list so we can pick a real cityId (filtered by picked state) */
  cities: Array<{ id: string; stateId: string; name: string }>;
};

export type CustomerFormPrefill = {
  name: string;
  shortName: string;
  customerPAN: string;
  gstNo: string;
  disallowNewLRBooking: boolean;
  creditLimit: string;
  interestRateLatePayment: string;
  tdsDeductionRate: string;
  country: string;
  stateId: string;
  cityId: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  mobileNo: string;
  primaryEmail: string;
  website: string;
};

export function prefillCustomer(opts: CustomerPrefillOptions): CustomerFormPrefill {
  const { states, cities } = opts;

  const companyName = fakeCompanyName();
  const shortName = fakeShortName(companyName);
  const contactPerson = fakeName();
  const pan = fakePAN();
  const gstin = fakeGSTIN();
  const email = fakeEmail(companyName);
  const website = fakeWebsite(companyName);
  const address = fakeAddress();

  const state = states.length > 0
    ? states[randInt(0, states.length - 1)]!
    : null;

  const stateCities = state
    ? cities.filter((c) => c.stateId === state.id)
    : cities;

  const city = stateCities.length > 0
    ? stateCities[randInt(0, stateCities.length - 1)]!
    : cities.length > 0 ? cities[0]! : null;

  return {
    name: companyName,
    shortName,
    customerPAN: pan,
    gstNo: gstin,
    disallowNewLRBooking: false,
    creditLimit: String(randInt(10, 500) * 10000),
    interestRateLatePayment: String(randInt(1, 24)),
    tdsDeductionRate: String(randInt(1, 10)),
    country: "India",
    stateId: state?.id ?? "",
    cityId: city?.id ?? "",
    address,
    contactPerson,
    contactPhone: fakeIndianPhone(),
    mobileNo: fakeIndianPhone(),
    primaryEmail: email,
    website,
  };
}
