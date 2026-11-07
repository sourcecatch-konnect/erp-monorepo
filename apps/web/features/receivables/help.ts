import type { PageHelpContent } from "@/features/training";

/** Help panel for Client Payment Receivable (A7). Review with Accounts. */
export const RECEIPTS_HELP: PageHelpContent = {
  title: "Client Payment Receivable",
  purpose:
    "Record money received from customers and match it to their bills, including any TDS they deducted.",
  stage: "accounts.receipt",
  howTo: [
    "Press the button to add a new receipt.",
    "Enter the amount, date and bank details of the payment.",
    "Match it to the customer's bills and enter any TDS on each bill.",
    "Save, then send it for approval.",
  ],
  next: "When the receipt is posted, the bills show as paid and the customer's ledger is updated.",
  mistakes: [
    "Forgetting the TDS the customer deducted, so the bill looks only part paid.",
    "Matching the payment to the wrong bill of the same customer.",
  ],
  terms: ["tds"],
  trainingStep: "acc.receipt",
  hi: {
    purpose:
      "Customer से आया पैसा दर्ज कीजिए और उसे उनके bill से match कीजिए — उन्होंने जो TDS काटा है वो भी।",
    howTo: [
      "नया receipt जोड़ने के लिए button दबाइए।",
      "Payment की amount, तारीख़ और bank details भरिए।",
      "उसे customer के bill से match कीजिए और हर bill पर TDS भरिए।",
      "Save कीजिए, फिर approval के लिए भेजिए।",
    ],
    next: "Receipt post होते ही bill paid दिखने लगते हैं और customer का ledger update हो जाता है।",
  },
};
