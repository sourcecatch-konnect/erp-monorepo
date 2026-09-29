import { db } from "../../../prisma/prisma.js";
import { publishNotificationEvent } from "../notifications/notification.service.js";

/**
 * Daily license-expiry reminder sweep for the Driver Lifecycle module
 * (docs/ERP_MODULE_PLAN_V2.md §6.3: "cron-driven scan emits 60/30/7-day-before
 * notifications"). The hard block on trip-create lives separately in
 * trip.route.ts / vehicle-journey.route.ts — this sweep only handles the
 * advance warning so someone can renew the license before it actually blocks
 * anything.
 *
 * Each threshold notifies once per driver (dedupeKey includes the threshold),
 * so a driver crossing 60 -> 30 -> 7 days out gets exactly three reminders,
 * not one per day.
 */

const THRESHOLD_DAYS = [60, 30, 7] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export const runDriverLicenseExpirySweep = async (): Promise<void> => {
  const now = Date.now();

  for (const threshold of THRESHOLD_DAYS) {
    const windowStart = new Date(now);
    const windowEnd = new Date(now + threshold * DAY_MS);

    const expiringDrivers = await db.driver.findMany({
      where: {
        licenseExpiryDate: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true, name: true, licenseNo: true, licenseExpiryDate: true },
    });

    for (const driver of expiringDrivers) {
      const daysLeft = Math.ceil(
        (driver.licenseExpiryDate!.getTime() - now) / DAY_MS,
      );
      // Reuses the event type already seeded in notification.seed.ts
      // ("driver.dl.expiring" — Branch Manager, IN_APP+EMAIL+WHATSAPP) —
      // only the sweep that actually triggers it was missing.
      await publishNotificationEvent({
        eventType: "driver.dl.expiring",
        sourceModule: "driver",
        aggregateType: "Driver",
        aggregateId: driver.id,
        payload: {
          driverName: driver.name,
          licenseNo: driver.licenseNo ?? "",
          daysLeft: String(daysLeft),
          expiryDate: driver.licenseExpiryDate!.toISOString().slice(0, 10),
          linkUrl: `/masters/drivers/${driver.id}`,
        },
        // Threshold in the key: crossing 60 -> 30 -> 7 fires a fresh
        // reminder each time, but re-running the sweep the same day doesn't
        // duplicate it.
        dedupeKey: `driver.dl.expiring:${driver.id}:${threshold}`,
      });
    }
  }
};

/** Run shortly after boot, then daily. */
export const startDriverLicenseExpirySweep = (): void => {
  const run = () =>
    runDriverLicenseExpirySweep().catch((error) =>
      console.error("[driver] License-expiry sweep failed:", error),
    );
  setTimeout(run, 60 * 1000);
  setInterval(run, DAY_MS);
};
