import type { PageHelpContent } from "@/features/training";

/** Help panel for the Trips list (A7). Review with Operations. */
export const TRIPS_HELP: PageHelpContent = {
  title: "Trips",
  purpose:
    "A trip puts LRs on a truck with a driver. See every trip, where it is, and what is still open.",
  stage: "road.trip",
  howTo: [
    "Press New Trip, choose the vehicle and driver, and attach the LRs the truck carries.",
    "Use the cards at the top to see planned, in-transit and closed trips.",
    "Open a trip to add expenses and driver advances while it is on the road.",
  ],
  next:
    "When the vehicle is back, close its journey. The Log Slip is created straight away.",
  mistakes: [
    "Forgetting to attach every LR the truck is really carrying.",
    "Entering expenses on the wrong trip of the same vehicle.",
  ],
  terms: ["market-vehicle", "happay", "vehicle-journey"],
  trainingStep: "ops.trip",
};
