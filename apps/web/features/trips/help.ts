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
  next: "When the vehicle is back, close its journey. The Log Slip is created straight away.",
  mistakes: [
    "Forgetting to attach every LR the truck is really carrying.",
    "Entering expenses on the wrong trip of the same vehicle.",
  ],
  terms: ["market-vehicle", "happay", "vehicle-journey"],
  trainingStep: "ops.trip",
  hi: {
    purpose:
      "Trip यानी LR को एक truck और ड्राइवर के साथ भेजना। हर trip कहाँ है और क्या अभी खुला है, सब यहाँ दिखता है।",
    howTo: [
      "New Trip दबाइए, गाड़ी और ड्राइवर चुनिए, और जो LR truck ले जा रहा है वे जोड़िए।",
      "ऊपर के cards से planned, in-transit और closed trips देखिए।",
      "Trip खोलकर, गाड़ी के चलते-चलते ही ख़र्च और ड्राइवर के advance भरते रहिए।",
    ],
    next: "गाड़ी लौटने पर उसकी journey बंद कीजिए। Log Slip उसी समय बन जाती है।",
  },
};
