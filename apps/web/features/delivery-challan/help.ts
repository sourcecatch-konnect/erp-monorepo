import type { PageHelpContent } from "@/features/training";

/** Help panel for Delivery Challans (A7). Review with Rail ops. */
export const DELIVERY_CHALLANS_HELP: PageHelpContent = {
  title: "Delivery Challans",
  purpose:
    "A Delivery Challan (DC) hands a group of LRs to the truck that does the last-mile delivery from the railhead.",
  stage: "rail.dc",
  howTo: [
    "Press Create Delivery Challan and choose the branch GRN goods going out.",
    "Put all LRs leaving on the same truck on one challan.",
    "Issue the challan when the truck leaves.",
  ],
  next: "The truck delivers the LRs. Each LR is then marked delivered and its POD uploaded.",
  mistakes: [
    "Putting LRs for two different trucks on one challan.",
    "Issuing before the branch GRN is submitted.",
  ],
  terms: ["dc", "ldc", "broker"],
  trainingStep: "rail.dc",
  hi: {
    purpose:
      "Delivery Challan (DC) से LR का एक group उस truck को सौंपा जाता है जो railhead से last-mile delivery करता है।",
    howTo: [
      "Create Delivery Challan दबाइए और जो branch GRN का माल बाहर जा रहा है वो चुनिए।",
      "एक ही truck में जाने वाले सारे LR एक ही challan पर डालिए।",
      "Truck निकलते समय challan issue कीजिए।",
    ],
    next: "Truck LR deliver करता है। फिर हर LR को delivered मार्क कीजिए और उसका POD upload कीजिए।",
  },
};
