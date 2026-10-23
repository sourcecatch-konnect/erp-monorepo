import { describe, expect, it } from "vitest";
import { assertLicenceValid, isLicenceExpired } from "../driver-licence.js";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
// 2 Oct 2026, 10:00 India time.
const now = new Date("2026-10-02T04:30:00.000Z");

describe("isLicenceExpired", () => {
  it("is valid through its expiry day", () => {
    expect(isLicenceExpired(day("2026-10-02"), now)).toBe(false);
    expect(isLicenceExpired(day("2027-01-15"), now)).toBe(false);
  });

  it("is expired from the day after", () => {
    expect(isLicenceExpired(day("2026-10-01"), now)).toBe(true);
  });

  it("uses India's date, not UTC's, just after midnight", () => {
    // 3 Oct 00:30 IST = 2 Oct 19:00 UTC — a licence ending 2 Oct has expired.
    expect(isLicenceExpired(day("2026-10-02"), new Date("2026-10-02T19:00:00.000Z"))).toBe(true);
  });

  it("never blocks a driver with no expiry date recorded", () => {
    expect(isLicenceExpired(null, now)).toBe(false);
    expect(isLicenceExpired(undefined, now)).toBe(false);
  });
});

describe("assertLicenceValid", () => {
  it("names the driver, the date and what was refused", () => {
    expect(() =>
      assertLicenceValid({ name: "Jasim", licenseExpiryDate: day("2026-09-30") }, "dispatching this trip", now),
    ).toThrow(/Jasim's driving licence expired on 2026-09-30 .* before dispatching this trip/);
  });

  it("checks the trip's own date: a back-dated trip before the expiry is allowed", () => {
    const driver = { name: "Jasim", licenseExpiryDate: day("2026-09-30") };
    // Expired today (2 Oct), but the trip is dated 25 Sep.
    expect(() =>
      assertLicenceValid(driver, "assigning a trip", new Date("2026-09-25T06:00:00.000Z")),
    ).not.toThrow();
  });

  it("blocks a trip planned for after the expiry, even if valid today", () => {
    const driver = { name: "Jasim", licenseExpiryDate: day("2026-11-05") };
    expect(() =>
      assertLicenceValid(driver, "assigning a trip", new Date("2026-11-10T06:00:00.000Z")),
    ).toThrow(/expired on 2026-11-05 \(the trip date 2026-11-10 is after that\)/);
  });

  it("passes a valid licence", () => {
    expect(() =>
      assertLicenceValid({ name: "Jasim", licenseExpiryDate: day("2027-03-01") }, "starting a journey", now),
    ).not.toThrow();
  });
});
