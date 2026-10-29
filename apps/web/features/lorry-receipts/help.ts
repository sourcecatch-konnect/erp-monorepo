import type { PageHelpContent } from "@/features/training";

/** Help panels for LR screens (A7) and the LR form tour (A8). Review with Operations. */
export const LR_LIST_HELP: PageHelpContent = {
  title: "Lorry Receipts",
  purpose:
    "Every LR (Lorry Receipt) in your branches: the legal document for each consignment, from draft to delivery and POD.",
  stage: "booking.lr",
  howTo: [
    "Use Create from Order for LRs of a confirmed order, or Create Instant LR for walk-in freight.",
    "Search by LR number, customer or vehicle, and use the status tabs to narrow the list.",
    "Click an LR to see its goods, freight, trip, delivery and documents.",
  ],
  next: "A finalised LR goes on a trip (or a VP for rail). When the goods arrive, it is marked delivered and the POD is uploaded.",
  mistakes: [
    "Finalising before checking the consignee and goods. A finalised LR can't be freely changed.",
    "Making an instant LR for goods that already have an order.",
  ],
  terms: ["lr", "consignor", "consignee", "pod"],
  trainingStep: "ops.create-lr",
  /*
   * Hinglish in Devanagari: the work words (LR, POD, order, draft) stay in
   * English because that is what people say on the floor, and a hi-IN voice
   * reads them naturally in the middle of a Hindi sentence. Translating them
   * to formal Hindi would be correct and useless.
   */
  hi: {
    purpose:
      "आपकी branches के सारे LR — हर consignment का legal document, draft से delivery और POD तक।",
    howTo: [
      "Confirmed order के LR के लिए Create from Order लीजिए, और walk-in freight के लिए Create Instant LR।",
      "LR number, customer या vehicle से search कीजिए, और status tabs से list छोटी कीजिए।",
      "किसी LR पर click कीजिए — उसका माल, freight, trip, delivery और documents दिखेंगे।",
    ],
    next: "Finalised LR किसी trip पर जाता है, या rail के लिए VP पर। माल पहुँचने पर उसे delivered मार्क कीजिए और POD upload कीजिए।",
  },
};

export const LR_FORM_HELP: PageHelpContent = {
  title: "Create an LR",
  purpose:
    "Fill in one LR: who sends and receives the goods, what the goods are, the freight, and the vehicle.",
  stage: "booking.lr",
  howTo: [
    "Work through the sections from top to bottom.",
    "Add one consignment line for each lot of goods.",
    "Check the summary on the right, then press Create LR at the top.",
  ],
  next: "The LR is saved as a draft. A manager finalises it, which gives it its LR number.",
  mistakes: [
    "Leaving the consignee's address or the goods quantity empty. The LR can't be finalised without them.",
    "Choosing the wrong truck of a multi-truck order.",
  ],
  terms: ["lr", "consignor", "consignee", "market-vehicle"],
  trainingStep: "ops.create-lr",
  /** `tour` is positional: one line per step, in the same order as below. */
  hi: {
    purpose:
      "एक LR भरिए — माल कौन भेज रहा है और कौन लेगा, माल क्या है, freight कितना है, और गाड़ी कौन सी है।",
    howTo: [
      "ऊपर से नीचे, एक-एक section भरते जाइए।",
      "माल के हर lot के लिए एक consignment line जोड़िए।",
      "दाईं तरफ़ का summary जाँचिए, फिर ऊपर Create LR दबाइए।",
    ],
    next: "LR draft में save हो जाता है। Manager उसे finalise करता है, तभी उसका LR number बनता है।",
    tour: [
      "यह LR form है। नीचे के sections ऊपर से नीचे भरिए, फिर यहाँ Create LR दबाइए।",
      "यह LR एक order से आया है। चुनिए कि यह order के किस truck के लिए है।",
      "Consignor चुनिए — जो माल भेज रहा है, और consignee — जो माल लेगा।",
      "हर consignment के लिए एक line जोड़िए: consignee, माल, quantity और freight।",
      "बताइए कि गाड़ी SK की अपनी है या hired market vehicle, और trip जोड़िए।",
      "यह सब जोड़कर total दिखाता है। Save करने से पहले इसे जाँच लीजिए।",
      "सब भर जाने पर यह दबाइए। Draft LR को finalise होने से पहले आप फिर भी बदल सकते हैं।",
    ],
  },
  tour: {
    key: "lr-form",
    steps: [
      {
        target: '[data-tour="lr-header"]',
        title: "Start here",
        content:
          "This is the LR form. Fill in the sections below from top to bottom, then press Create LR here.",
      },
      {
        target: '[data-tour="lr-truck"]',
        title: "Pick the truck",
        content:
          "This LR comes from an order. Choose which of the order's trucks it is for.",
      },
      {
        target: '[data-tour="lr-parties"]',
        title: "Who sends and who receives",
        content:
          "Choose the consignor (who sends the goods) and the consignee (who receives them).",
      },
      {
        target: '[data-tour="lr-lines"]',
        title: "Add the consignments",
        content:
          "Add one line for each consignment: the consignee, the goods, the quantity and the freight.",
      },
      {
        target: '[data-tour="lr-vehicle"]',
        title: "Choose the vehicle",
        content:
          "Say whether it is SK's own vehicle or a hired market vehicle, and attach the trip.",
      },
      {
        target: '[data-tour="lr-summary"]',
        title: "Check the summary",
        content: "This adds everything up. Check it before you save.",
      },
      {
        target: '[data-tour="lr-submit"]',
        title: "Create the LR",
        content:
          "Press this when everything is filled in. You can still edit a draft LR before it is finalised.",
      },
    ],
  },
};

export type LrNextStepHint = {
  title: string;
  text: string;
  action?: { label: string; href: string };
};

/** "What now?" for an LR truckload, from its status (shown on the LR page). */
export function lrNextStep(
  status: string,
  options: { canFinalise: boolean; blocked: boolean },
): LrNextStepHint | null {
  switch (status) {
    case "DRAFT":
      if (options.blocked) return null; // the missing-information warning says what to do
      return options.canFinalise
        ? {
            title: "Next: finalise this LR",
            text: "Check the consignor, consignee, goods and freight, then press Finalise. That gives the LR its number.",
          }
        : {
            title: "This LR is a draft",
            text: "A manager finalises it after checking the details.",
          };
    case "FINALISED":
      return {
        title: "Next: move the goods and deliver them",
        text: "Put the LR on a trip (or a VP for rail). When the goods reach the consignee, mark it delivered in Deliveries.",
        action: {
          label: "Open Deliveries",
          href: "/lorry-receipts/deliveries",
        },
      };
    case "DELIVERED":
      return {
        title: "Next: upload the signed POD",
        text: "Accounts can bill this LR once its POD is in. Use the Pending POD tab.",
        action: {
          label: "Open Deliveries",
          href: "/lorry-receipts/deliveries",
        },
      };
    default:
      return null;
  }
}
