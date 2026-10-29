import type { PageHelpContent } from "@/features/training";

/** Help panels for vehicle journeys and the Log Slip (A7), plus its tour (A8). */
export const JOURNEYS_HELP: PageHelpContent = {
  title: "Vehicle Journeys",
  purpose:
    "A vehicle journey is one full outing of a truck, from leaving to coming back. It can have more than one trip.",
  stage: "road.close",
  howTo: [
    "Press Start Journey when a vehicle leaves.",
    "Its trips, expenses and advances collect on the journey as they happen.",
    "When the vehicle is back, open the journey and close it, then generate the Log Slip.",
  ],
  next: "The Log Slip is posted to accounts and the driver's balance is settled.",
  mistakes: [
    "Closing the journey before all expenses are entered.",
    "Typing the end kilometres wrongly. The diesel average is worked out from them.",
  ],
  terms: ["vehicle-journey", "log-slip", "happay"],
  trainingStep: "bm.close-journey",
  hi: {
    purpose:
      "Vehicle journey यानी truck का एक पूरा चक्कर — निकलने से लौटने तक। एक journey में एक से ज़्यादा trip हो सकते हैं।",
    howTo: [
      "गाड़ी निकलते समय Start Journey दबाइए।",
      "उसके trip, ख़र्च और advance जैसे-जैसे होते हैं, journey पर जुड़ते जाते हैं।",
      "गाड़ी लौटने पर journey खोलकर बंद कीजिए, फिर Log Slip बनाइए।",
    ],
    next: "Log Slip accounts में post होती है और ड्राइवर का हिसाब चुकता हो जाता है।",
  },
};

export const LOG_SLIP_HELP: PageHelpContent = {
  title: "Log Slip",
  purpose:
    "The official record of a finished journey: kilometres, diesel, freight, expenses and what is owed to or by the driver.",
  stage: "road.close",
  howTo: [
    "Check the warnings at the top first. A journey with open trips can't be settled.",
    "Fill in the log slip date and the diesel figures, then press Generate Log Slip.",
    "Print it, then post it to accounts.",
  ],
  next: "Posting creates the accounting entry. To change a posted slip, someone with permission must reopen it with a reason.",
  mistakes: [
    "Using an old diesel rate, which makes the diesel cost wrong.",
    "Posting before checking the driver settlement amount.",
  ],
  terms: ["log-slip", "vehicle-journey"],
  trainingStep: "bm.close-journey",
  hi: {
    purpose:
      "पूरी हुई journey का असली record: किलोमीटर, diesel, freight, ख़र्च, और ड्राइवर को कितना देना या उससे कितना लेना है।",
    howTo: [
      "सबसे पहले ऊपर की warning देखिए। जिस journey के trip खुले हों, उसका हिसाब नहीं हो सकता।",
      "Log slip की तारीख़ और diesel के आँकड़े भरिए, फिर Generate Log Slip दबाइए।",
      "Print कीजिए, फिर accounts में post कीजिए।",
    ],
    next: "Post करते ही accounting entry बन जाती है। Post हुई slip बदलनी हो तो permission वाला व्यक्ति कारण लिखकर उसे reopen करेगा।",
    tour: [
      "यहाँ उस journey की गाड़ी, ड्राइवर और किलोमीटर दिखते हैं जिसका हिसाब आप कर रहे हैं।",
      "तारीख़ और diesel के आँकड़े जाँचिए, कुछ कहना हो तो remarks लिखिए, फिर Generate दबाइए। Slip तुरंत बन जाती है।",
      "ये total दिखाते हैं freight, ख़र्च, और ड्राइवर को कितना देना या उससे कितना लेना है।",
      "Total के पीछे की हर freight, advance, diesel और expense की line यहाँ है।",
      "Generate के बाद slip print कीजिए और accounts में post कीजिए।",
    ],
  },
  tour: {
    key: "log-slip",
    steps: [
      {
        target: '[data-tour="logslip-header"]',
        title: "The journey",
        content: "This shows the vehicle, driver and kilometres of the journey you are settling.",
      },
      {
        target: '[data-tour="logslip-generate"]',
        title: "Generate the Log Slip",
        content:
          "Check the date and diesel figures, add remarks if needed, then press Generate. It is ready straight away.",
      },
      {
        target: '[data-tour="logslip-totals"]',
        title: "The result",
        content: "These totals show the freight, the costs and what is owed to or by the driver.",
      },
      {
        target: '[data-tour="logslip-lines"]',
        title: "The details",
        content: "Every freight, advance, diesel and expense line behind the totals.",
      },
      {
        target: '[data-tour="logslip-actions"]',
        title: "Print and post",
        content: "After generating, print the slip and post it to accounts.",
      },
    ],
  },
};
