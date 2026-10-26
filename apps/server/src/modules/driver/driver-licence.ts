import { BadRequestError } from "../../lib/error.js";

/**
 * Driving-licence validity — one rule for every place a driver is put on the
 * road (journey start, a trip or next journey leg, dispatch, the driver
 * pickers). A licence is valid through its expiry day (India time); a driver
 * with no expiry date recorded is not blocked.
 */

const todayInIndia = (now: Date) => now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function isLicenceExpired(
  licenseExpiryDate: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!licenseExpiryDate) return false;
  return licenseExpiryDate.toISOString().slice(0, 10) < todayInIndia(now);
}

/**
 * Refuse with a clear message when the driver's licence is not valid on
 * `at` — the trip / journey's own date (start, planned start or dispatch),
 * so a back-dated trip from before the expiry is allowed and a trip planned
 * for after it is not.
 */
export function assertLicenceValid(
  driver: { name: string; licenseExpiryDate: Date | null },
  action: string,
  at: Date = new Date(),
): void {
  if (isLicenceExpired(driver.licenseExpiryDate, at)) {
    const expiry = driver.licenseExpiryDate!.toISOString().slice(0, 10);
    const day = todayInIndia(at);
    const onDate = day === todayInIndia(new Date()) ? "" : ` (the trip date ${day} is after that)`;
    throw new BadRequestError(
      `${driver.name}'s driving licence expired on ${expiry}${onDate} — renew it in the Driver master before ${action}`,
    );
  }
}
