import type { PageHelpContent } from "@/features/training";

/** Help panels for VP Loading (A7) and the loading form tour (A8). Review with Rail ops. */
export const VP_LOADING_HELP: PageHelpContent = {
  title: "VP Loading",
  purpose:
    "Record the goods physically loaded into each wagon (VP) of a rake, against its VP schedule.",
  stage: "rail.vp-loading",
  howTo: [
    "Press the add button to load goods into a wagon.",
    "Each row is one wagon. Open it to see what was loaded and by whom.",
    "When every wagon is loaded and checked, the VP schedule moves on to Loaded and Verified.",
  ],
  next: "The rake leaves. At the rail head, record the rake and the GRN.",
  mistakes: [
    "Loading more than the wagon's capacity. The ERP warns you; only override if you are allowed to.",
    "Picking the wrong wagon when two VPs look alike. Check the VP number.",
  ],
  terms: ["vp", "rake", "hamali"],
  trainingStep: "rail.vp-loading",
  hi: {
    purpose:
      "Rake के हर wagon (VP) में असल में जो माल लोड हुआ, वो उसके VP schedule के सामने दर्ज कीजिए।",
    howTo: [
      "Wagon में माल लोड करने के लिए add button दबाइए।",
      "हर row एक wagon है। खोलकर देखिए क्या लोड हुआ और किसने किया।",
      "सारे wagon लोड और check हो जाने पर VP schedule Loaded and Verified पर चला जाता है।",
    ],
    next: "Rake निकल जाती है। Rail head पर rake और GRN दर्ज कीजिए।",
  },
};

export const VP_LOADING_FORM_HELP: PageHelpContent = {
  ...VP_LOADING_HELP,
  title: "Load a wagon",
  purpose:
    "Add goods from one LR/GRN into one wagon (VP) of the rake, with any damage and labour.",
  howTo: [
    "Choose the schedule, the wagon and the LR/GRN in Loading Selection.",
    "Enter the quantity loaded and any damage in Goods Loading.",
    "Add labour (hamali) and notes, check the summary, then press Add GRN to Wagon.",
  ],
  // Overrides the list screen's Hindi, which the spread above would otherwise
  // carry over and describe the wrong screen.
  hi: {
    purpose:
      "एक LR/GRN का माल rake के एक wagon (VP) में डालिए — damage और labour के साथ।",
    howTo: [
      "Loading Selection में schedule, wagon और LR/GRN चुनिए।",
      "Goods Loading में कितना लोड हुआ और कोई damage हो तो वो भरिए।",
      "Hamali और notes जोड़िए, summary देखिए, फिर Add GRN to Wagon दबाइए।",
    ],
    next: "सारे wagon लोड और check हो जाने पर VP schedule Loaded and Verified पर चला जाता है।",
    tour: [
      "यहाँ आप दर्ज करते हैं कि rake के एक wagon (VP) में असल में क्या माल लोड हुआ।",
      "VP schedule, wagon और जिस LR/GRN का माल जा रहा है वो चुनिए।",
      "कितना लोड हुआ और कोई damage हो तो भरिए। Wagon की capacity से ज़्यादा होने पर ERP चेतावनी देता है।",
      "Hamali यानी लोडिंग की मज़दूरी और इस loading के notes यहाँ लिखिए।",
      "इस तरफ़ दिखता है आपने क्या चुना और कुल कितना हुआ।",
      "माल को wagon में जोड़ने के लिए यह दबाइए।",
    ],
  },
  tour: {
    key: "vp-loading",
    steps: [
      {
        target: '[data-tour="vpl-header"]',
        title: "Load a wagon",
        content: "Here you record the goods physically loaded into one wagon (VP) of the rake.",
      },
      {
        target: '[data-tour="vpl-selection"]',
        title: "Choose the schedule and wagon",
        content: "Pick the VP schedule, the wagon and the LR/GRN whose goods are going in.",
      },
      {
        target: '[data-tour="vpl-goods"]',
        title: "Enter what was loaded",
        content: "Enter the quantity loaded and any damage. The ERP warns you if the wagon would be over capacity.",
      },
      {
        target: '[data-tour="vpl-labour"]',
        title: "Labour and notes",
        content: "Record hamali (loading labour) and any notes for this loading.",
      },
      {
        target: '[data-tour="vpl-summary"]',
        title: "Check the summary",
        content: "This side shows what you picked and the totals.",
      },
      {
        target: '[data-tour="vpl-submit"]',
        title: "Save it",
        content: "Press this to add the goods to the wagon.",
      },
    ],
  },
};
