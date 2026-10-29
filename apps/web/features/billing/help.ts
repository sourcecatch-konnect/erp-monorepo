import type { PageHelpContent } from "@/features/training";

/** Help panels for billing screens (A7) and the LR to Bill tour (A8). Review with Accounts. */
export const LR_TO_BILL_HELP: PageHelpContent = {
  title: "LR to Bill",
  purpose:
    "Make a bill from delivered LRs: choose who pays, pick the LRs, add common charges and check the GST.",
  stage: "accounts.bill",
  howTo: [
    "Choose the bill head (consignor or consignee), the transport type and the client.",
    "Tick the delivered LRs to put on this bill.",
    "Add any common charges, check the summary, then press Create Draft Bill.",
  ],
  next:
    "The draft bill appears in the Billing Register. Check it there and finalise it to give it a bill number.",
  mistakes: [
    "Choosing the wrong bill head, so the bill goes to the wrong party.",
    "Looking for an LR whose POD isn't in yet. Only delivered LRs with a POD can be billed.",
  ],
  terms: ["place-of-supply", "gst", "rcm", "tds"],
  trainingStep: "acc.lr-to-bill",
  hi: {
    purpose:
      "Delivered LR से bill बनाइए: कौन pay करेगा वो चुनिए, LR चुनिए, common charges जोड़िए और GST जाँच लीजिए।",
    howTo: [
      "Bill head (consignor या consignee), transport type और client चुनिए।",
      "इस bill पर जो delivered LR डालने हैं, उन्हें tick कीजिए।",
      "Common charges जोड़िए, summary देखिए, फिर Create Draft Bill दबाइए।",
    ],
    next: "Draft bill Billing Register में दिखेगा। वहीं जाँचकर finalise कीजिए, तभी bill number मिलता है।",
    tour: [
      "सबसे पहले bill head — consignor या consignee — चुनिए, फिर transport type और client।",
      "यहाँ सिर्फ़ वही delivered LR दिखते हैं जिनका POD आ चुका है। जो इस bill पर डालने हैं, tick कीजिए।",
      "Freight हर LR से अपने आप आता है। कोई common charge हो तो यहाँ जोड़िए।",
      "माल कहाँ गया, उसी से GST बनता है। Bill बनाने से पहले total जाँच लीजिए।",
      "इससे draft बनता है। Billing Register में finalise कीजिए, तभी bill number मिलेगा।",
    ],
  },
  tour: {
    key: "lr-to-bill",
    steps: [
      {
        target: '[data-tour="bill-info"]',
        title: "Who is billed",
        content: "First choose the bill head (consignor or consignee), the transport type and the client.",
      },
      {
        target: '[data-tour="bill-eligible"]',
        title: "Pick the LRs",
        content: "Only delivered LRs with their POD show here. Tick the ones to put on this bill.",
      },
      {
        target: '[data-tour="bill-selected"]',
        title: "Check LRs and charges",
        content: "The freight comes from each LR. Add any common charges here.",
      },
      {
        target: '[data-tour="bill-summary"]',
        title: "Check the totals",
        content: "GST is worked out from where the goods went. Check the total before you create the bill.",
      },
      {
        target: '[data-tour="bill-create"]',
        title: "Create the draft bill",
        content: "This makes a draft. Finalise it in the Billing Register to give it a bill number.",
      },
    ],
  },
};

export const BILLING_REGISTER_HELP: PageHelpContent = {
  title: "Billing Register",
  purpose: "Every bill, with its status from draft to paid.",
  stage: "accounts.bill",
  howTo: [
    "Open a draft bill to check it, then approve and finalise it.",
    "Print or send finalised bills to the customer.",
    "Raise a credit note if a finalised bill needs to be reduced.",
  ],
  next: "When the customer pays, record the payment in Client Payment Receivable.",
  mistakes: [
    "Sending a bill to the customer before it is finalised.",
    "Cancelling a finalised bill instead of raising a credit note.",
  ],
  terms: ["gst", "place-of-supply", "hsn-sac"],
  trainingStep: "acc.finalise-bill",
  hi: {
    purpose: "हर bill, draft से paid तक उसके status के साथ।",
    howTo: [
      "Draft bill खोलकर जाँचिए, फिर approve करके finalise कीजिए।",
      "Finalise हुए bill customer को print या भेज दीजिए।",
      "Finalised bill कम करना हो तो credit note बनाइए।",
    ],
    next: "Customer का payment आने पर उसे Client Payment Receivable में दर्ज कीजिए।",
  },
};
