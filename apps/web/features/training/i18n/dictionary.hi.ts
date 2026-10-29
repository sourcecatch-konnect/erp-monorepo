/**
 * Hindi strings for the training screens, keyed by content id.
 *
 * The English stays where it has always been — in content/stages.ts,
 * content/glossary.ts and the catalog — and is always the fallback. Nothing
 * here is required: an id with no entry simply renders its English, so this
 * file can be filled a batch at a time without anything half-translated ever
 * reaching a user.
 *
 * Ids are built from keys that already exist, so no content had to move:
 *
 *   stage.<stageKey>.explain        STAGE_CONTENT["booking.lr"].explain
 *   stage.<stageKey>.output         STAGE_OUTPUT["booking.lr"]
 *   stage.<stageKey>.tip            STAGE_CONTENT["booking.lr"].tip
 *   glossary.<id>.meaning           GLOSSARY entry with id "lr"
 *   glossary.<id>.fullName
 *   lesson.<stepKey>.intro          LESSON_CONTENT["basics.navigation"].intro
 *   lesson.<stepKey>.warn
 *
 * ---------------------------------------------------------------------------
 * TRANSLATION RULES — follow these when adding to this file
 * ---------------------------------------------------------------------------
 *
 * 1. The TERM ITSELF IS NEVER TRANSLATED. "LR", "POD", "VP", "TBB", "To Pay",
 *    "Rake", "Hamali", "Wharfage" are what the screens, the documents and the
 *    staff actually say. Translating them would teach a word nobody uses and
 *    nobody would find on a form. Only the MEANING is translated, and the term
 *    is repeated inside it in Roman script so the reader connects the two.
 *
 * 2. `fullName` is also left in English. "Lorry Receipt", "Railway Receipt",
 *    "Goods Transport Agency" are legal document and statute names; the Hindi
 *    for them is not what appears on the paper.
 *
 * 3. Government terms keep their English form: GST, CGST, SGST, IGST, TDS,
 *    HSN, SAC, RCM, GTA, E-way bill, Part-B, TRANSIN.
 *
 * 4. Write the Hindi the office speaks, not formal/literary Hindi. Mixing in
 *    everyday English words ("ट्रक", "कस्टमर", "बुक") is correct here — it is
 *    how the work is actually discussed.
 *
 * ---------------------------------------------------------------------------
 * REVIEW STATUS: DRAFT — NOT YET CHECKED BY BRANCH STAFF
 * ---------------------------------------------------------------------------
 * These 39 glossary meanings are a first draft. Before translating anything
 * else, show this list to someone who runs a branch and confirm the vocabulary
 * is the one they use. Correcting 39 strings is cheap; correcting 1,400 after
 * the fact is not.
 */
export const HI: Record<string, string> = {
  /* ---------------------------------------------------------------- */
  /* Glossary — booking                                                */
  /* ---------------------------------------------------------------- */
  "glossary.lr.meaning":
    "मुख्य ट्रांसपोर्ट डॉक्यूमेंट, हर कंसाइनमेंट के लिए एक। यह कानूनी सबूत है कि SK ने माल ढुलाई के लिए लिया है।",
  "glossary.order.meaning":
    "कस्टमर की माल भेजने की रिक्वेस्ट। कन्फर्म होने के बाद इसी से एक या ज़्यादा LR बनते हैं।",
  "glossary.consignor.meaning":
    "माल भेजने वाला व्यक्ति या कंपनी — आमतौर पर वही कस्टमर जिसने बुकिंग की है।",
  "glossary.consignee.meaning": "माल लेने वाला व्यक्ति या कंपनी।",
  "glossary.pod.meaning":
    "डिलीवरी की रसीद जिस पर कंसाइनी के हस्ताक्षर होते हैं। इसे स्कैन करके ERP में डाला जाता है, और LR की बिलिंग इसके बिना नहीं हो सकती।",
  "glossary.ewb.meaning":
    "₹50,000 से ज़्यादा कीमत के माल के लिए ज़रूरी सरकारी ट्रांज़िट पास। इसे कस्टमर बनाता है; SK इसे LR से जोड़ता है।",
  "glossary.part-b.meaning":
    "E-way bill का वह हिस्सा जिसमें गाड़ी नंबर होता है। ट्रक तय होने पर SK इसे अपडेट करता है।",
  "glossary.transin.meaning":
    "GSTN से मिली SK की ट्रांसपोर्टर ID, जो E-way bill का Part-B अपडेट करते समय लगती है।",
  "glossary.docket.meaning":
    "कूरियर का ट्रैकिंग नंबर, जो कागज़ का POD हेड ऑफिस भेजते समय इस्तेमाल होता है।",

  /* ---------------------------------------------------------------- */
  /* Glossary — rail                                                   */
  /* ---------------------------------------------------------------- */
  "glossary.grn.meaning": "ब्रांच या रेल हेड पर असल में मिले माल का रिकॉर्ड।",
  "glossary.rake.meaning":
    "कई वैगन वाली पूरी मालगाड़ी, जो भारतीय रेलवे से बुक की जाती है।",
  "glossary.vp.meaning": "रेक पर एक वैगन जितनी जगह। एक रेक में कई VP होते हैं।",
  "glossary.rr.meaning":
    "हर VP के लिए भारतीय रेलवे का कानूनी डॉक्यूमेंट। कागज़ की कॉपी देखकर ERP में भरा जाता है।",
  "glossary.mr.meaning":
    "SK ने जो रेल भाड़ा दिया, उसकी रेलवे की रसीद। कागज़ की कॉपी से भरी जाती है।",
  "glossary.dc.meaning":
    "रेलहेड से आख़िरी डिलीवरी करने वाले ट्रक को LR का समूह सौंपता है। एक DC में कई LR आते हैं।",
  "glossary.ldc.meaning":
    "Delivery Challan का दूसरा नाम। स्क्रीन के नामों में जैसे 'LDC Ack' में दिखेगा।",
  "glossary.dc-wc.meaning":
    "वह फ़ॉर्म जिसमें रेल हेड पर रेक का demurrage, wharfage और कोई waiver दर्ज होता है। रेल स्क्रीन पर ये दोनों रक़म DC और WC लिखी आती हैं।",
  "glossary.demurrage.meaning":
    "भारतीय रेलवे का चार्ज, जब रेक या वैगन को फ्री समय से ज़्यादा रोका जाए। यह SK रेलवे को देता है।",
  "glossary.wharfage.meaning":
    "भारतीय रेलवे का चार्ज, जब माल रेलवे की जगह पर फ्री समय से ज़्यादा पड़ा रहे। Demurrage वैगन रोकने पर लगता है; wharfage माल ज़मीन पर पड़ा रहने पर।",
  "glossary.waiver.meaning":
    "रेलवे का पत्र जिससे SK पर लगा demurrage कम हो जाता है।",

  /* ---------------------------------------------------------------- */
  /* Glossary — road                                                   */
  /* ---------------------------------------------------------------- */
  "glossary.detention.meaning":
    "वह चार्ज जो SK कस्टमर से लेता है जब ट्रक या वैगन उसकी जगह पर ज़्यादा देर रुकाए जाएँ। यह demurrage से अलग है, जो SK रेलवे को देता है।",
  "glossary.market-vehicle.meaning":
    "बाहर से किराए पर लिया ट्रक, SK की अपनी गाड़ी के बजाय।",
  "glossary.log-slip.meaning":
    "वह पक्का रिकॉर्ड कि गाड़ी ने ट्रिप पूरी कर ली — आख़िरी किलोमीटर, समय और ख़र्चे के साथ। ट्रिप बंद करने पर बनता है।",
  "glossary.vehicle-journey.meaning":
    "गाड़ी का निकलने से लौटने तक का पूरा चक्कर। इसमें एक से ज़्यादा ट्रिप हो सकती हैं।",
  "glossary.happay.meaning":
    "ड्राइवरों को डीज़ल और टोल के लिए दिया जाने वाला प्रीपेड कार्ड। इसके ख़र्चे ट्रिप के ख़र्चों से मिलाए जाते हैं।",

  /* ---------------------------------------------------------------- */
  /* Glossary — accounts                                               */
  /* ---------------------------------------------------------------- */
  "glossary.tbb.meaning":
    "पेमेंट का एक तरीक़ा: कस्टमर को बाद में बिल भेजा जाता है, पहले या डिलीवरी पर पैसे लेने के बजाय।",
  "glossary.to-pay.meaning":
    "पेमेंट का वह तरीक़ा जिसमें भाड़ा माल की डिलीवरी के समय लिया जाता है।",
  "glossary.hamali.meaning": "माल चढ़ाने-उतारने वाली मज़दूरी का भुगतान।",
  "glossary.broker.meaning":
    "बाहरी पार्टी जो किराए के ट्रक देती है या रेलहेड पर माल संभालती है। SK इन्हें पेमेंट स्लिप से भुगतान करता है।",

  /* ---------------------------------------------------------------- */
  /* Glossary — tax & GST                                              */
  /* ---------------------------------------------------------------- */
  "glossary.gta.meaning":
    "GST क़ानून में SK जैसी ट्रांसपोर्ट कंपनी का वर्गीकरण। GTA सेवाओं के GST नियम अलग होते हैं।",
  "glossary.rcm.meaning":
    "GST का वह नियम जिसमें GST सरकार को कस्टमर भरता है, SK नहीं। तब SK बिल पर GST नहीं लगाता।",
  "glossary.place-of-supply.meaning":
    "GST के लिए वह राज्य जहाँ माल जा रहा है। इसी से तय होता है कि बिल पर CGST + SGST लगेगा या IGST।",
  "glossary.gst.meaning":
    "GST के हिस्से। एक ही राज्य के भीतर: CGST + SGST। दो राज्यों के बीच: IGST।",
  "glossary.hsn-sac.meaning":
    "माल के लिए (HSN) और सेवाओं के लिए (SAC) टैक्स कोड। ट्रांसपोर्ट सेवाओं में आमतौर पर 9965 लगता है।",
  "glossary.tds.meaning":
    "वह टैक्स जो कस्टमर पेमेंट में से काट लेता है (लगभग 2%) और SK की ओर से सरकार को भरता है। इसे रसीद पर दर्ज करें।",

  /* ---------------------------------------------------------------- */
  /* Glossary — general                                                */
  /* ---------------------------------------------------------------- */
  "glossary.rate-matrix.meaning":
    "रूट और गाड़ी के प्रकार के हिसाब से भाड़े की दरों की तालिका। ऑर्डर इसी से भाड़ा निकालते हैं।",
  "glossary.master-data.meaning":
    "वे बुनियादी सूचियाँ जिनमें से ERP चुनता है: कस्टमर, रूट, दरें, गाड़ियाँ, ड्राइवर वग़ैरह।",
  "glossary.fy.meaning":
    "अप्रैल से मार्च। FY26-27 यानी अप्रैल 2026 से मार्च 2027। हर FY में डॉक्यूमेंट नंबर फिर से शुरू होते हैं।",
  "glossary.branch-scope.meaning":
    "आप कौन-सी ब्रांच देख और उनमें काम कर सकते हैं। इसे आपका एडमिनिस्ट्रेटर तय करता है।",

  /* ---------------------------------------------------------------- */
  /* Lesson screen — headings and labels                               */
  /* ---------------------------------------------------------------- */
  "ui.lesson": "लेसन",
  "ui.of": "में से",
  "ui.doThisInOrder": "इस क्रम में कीजिए",
  "ui.beforeYouStart": "शुरू करने से पहले",
  "ui.beforeYouStartSpoken": "शुरू करने से पहले ये चाहिए:",
  "ui.beforeYouStartRow": "शुरू करने से पहले — ये चाहिए",
  "ui.watchOut": "ध्यान रखिए",
  "ui.watchOutSpoken": "ध्यान रखिए।",
  "ui.watchOutRow": "ध्यान रखिए — एक बात",
  "ui.wordsInLesson": "इस लेसन के शब्द",
  "ui.statusMoves": "status कैसे आगे बढ़ता है",
  "ui.listenToLesson": "यह लेसन सुनिए",

  /* Lesson groups */
  "lesson.group.Getting around": "शुरुआत",
  "lesson.group.Everyday screens": "रोज़ की screens",
  "lesson.group.Users and roles": "Users और roles",
  "lesson.group.Settings": "Settings",
  "lesson.group.Set up": "तैयारी",
  "lesson.group.Booking": "Booking",
  "lesson.group.Road transport": "सड़क परिवहन",
  "lesson.group.Delivery": "Delivery",

  /* ---------------------------------------------------------------- */
  /* Lessons — ERP basics                                              */
  /* ---------------------------------------------------------------- */
  "lesson.basics.navigation.title": "ERP में रास्ता पहचानिए",
  "lesson.basics.navigation.intro":
    "ERP में सब कुछ बाईं तरफ़ के menu से खुलता है। यह एक बार समझ लीजिए, फिर कोई भी screen मिल जाएगी।",

  "lesson.basics.my-role.title": "अपना role देखिए",

  "lesson.basics.process-map.title": "पूरा business एक नज़र में",
  "lesson.basics.process-map.intro":
    "Process map पूरे business को एक screen पर दिखाता है — कस्टमर के फ़ोन से लेकर पैसा आने तक।",

  "lesson.basics.lists.title": "List में search और filter",
  "lesson.basics.lists.intro":
    "ERP की हर list screen एक ही तरह चलती है। एक बार सीख लीजिए, फिर सब आसान हैं।",

  "lesson.basics.notifications.title": "अपने notifications देखिए",

  "lesson.basics.profile.title": "अपनी profile जाँचिए",

  "lesson.basics.glossary.title": "काम के शब्द सीखिए",
  "lesson.basics.glossary.intro":
    "ERP ट्रांसपोर्ट के काम के शब्द इस्तेमाल करता है। Glossary हर शब्द का मतलब आसान भाषा में बताता है।",

  /* ---------------------------------------------------------------- */
  /* Lessons — Administration                                          */
  /* ---------------------------------------------------------------- */
  "lesson.admin.users.title": "User जोड़िए और सँभालिए",
  "lesson.admin.users.intro":
    "User यानी एक व्यक्ति का login। हर user को सिर्फ़ एक role मिलता है, और वही role तय करता है कि वह क्या कर सकता है।",
  "lesson.admin.users.warn":
    "एक login दो लोगों में कभी मत बाँटिए। Audit log रखता है कि किसने क्या किया, और साझा login उसे बेकार कर देता है।",

  "lesson.admin.roles.title": "Roles बनाइए",
  "lesson.admin.roles.intro":
    "Role यानी permissions का एक सेट। Role एक बार बदलिए और वह सबको लग जाता है जिनके पास वह role है — इसलिए सोच-समझकर बदलिए।",
  "lesson.admin.roles.warn":
    "Built-in roles हर branch में एक जैसे चलते हैं। अगर सिर्फ़ एक व्यक्ति को कुछ ज़्यादा चाहिए, तो पूरे role को चौड़ा करने के बजाय उसे अलग से special permission दीजिए।",

  "lesson.admin.access.title": "Branch access दीजिए",
  "lesson.admin.access.intro":
    "Branch access तय करता है कि user कौन-से records देख भी सकता है। Role बताता है कि वह क्या कर सकता है; branch बताती है कि कहाँ।",
  "lesson.admin.access.warn":
    "ज़रूरत से ज़्यादा branch access सबसे चुपचाप होने वाली ग़लती है: व्यक्ति दूसरी branches के customers और rates देखने लगता है। उतना ही दीजिए जितना ज़रूरी है।",

  "lesson.admin.notifications.title": "Notification के नियम बनाइए",
  "lesson.admin.notifications.warn":
    "हर बात की alert सबको भेजेंगे तो लोग घंटी देखना ही छोड़ देंगे। Alert सिर्फ़ उसी को भेजिए जिसे कुछ करना है।",

  "lesson.admin.audit-log.title": "Audit log देखिए",
  "lesson.admin.audit-log.intro":
    "Audit log वह रिकॉर्ड है कि किसने क्या बदला। किसी बदलाव पर विवाद हो तो इसी से तय होता है।",
  "lesson.admin.audit-log.warn":
    "Log को कोई भी edit या delete नहीं कर सकता। इसका मतलब ही यही है — किसी से यह मत कहिए कि कोई entry मिटाई जा सकती है।",

  /* ---------------------------------------------------------------- */
  /* Lessons — Operations                                              */
  /* ---------------------------------------------------------------- */
  "lesson.ops.masters.title": "ज़रूरी master data जाँचिए",
  "lesson.ops.masters.intro":
    "Master data वे सूचियाँ हैं जिनमें से बाक़ी ERP चुनता है। जब तक customer, route और rate तीनों मौजूद न हों, order book नहीं हो सकता।",
  "lesson.ops.masters.warn":
    "यहाँ सबसे आम ग़लती है लगभग एक जैसे नाम वाले दो customers। चुनने से पहले GST number मिला लीजिए।",

  "lesson.ops.book-order.title": "Order book कीजिए",
  "lesson.ops.book-order.intro":
    "Order यानी कस्टमर की माल भेजने की रिक्वेस्ट: किस branch से किस branch तक, कब, और truck से या weight के हिसाब से। Save करते ही वह approval के लिए चला जाता है।",
  "lesson.ops.book-order.warn":
    "Save करने से पहले ERP का निकाला हुआ भाड़ा देख लीजिए। अगर ग़लत लगे तो rate matrix ग़लत है — उसे ठीक कीजिए, नंबर के ऊपर मत लिखिए।",

  "lesson.ops.order-status.title": "Order का approval देखिए",

  "lesson.ops.create-lr.title": "LR बनाइए",
  "lesson.ops.create-lr.intro":
    "LR कानूनी सबूत है कि SK ने माल लिया है। हर consignment के लिए एक LR बनाइए। Finalise करने पर ही उसे LR number मिलता है।",
  "lesson.ops.create-lr.warn":
    "Finalise करने से पहले consignee का पता जाँच लीजिए। LR number जारी होने के बाद पता बदलवाने के लिए manager चाहिए।",

  "lesson.ops.ewaybill.title": "E-way bill जोड़िए",
  "lesson.ops.ewaybill.intro":
    "E-way bill सरकारी डॉक्यूमेंट है जो माल के साथ चलना ज़रूरी है। आमतौर पर कस्टमर इसे बनाता है और आपको नंबर देता है।",
  "lesson.ops.ewaybill.warn":
    "Expire हो चुका e-way bill चेकपोस्ट पर जुर्माना है। Truck लेट हो रहा हो तो expire होने से पहले ही बढ़ा दीजिए — बाद में नहीं बढ़ता।",

  "lesson.ops.trip.title": "Trip बनाइए",
  "lesson.ops.trip.intro":
    "Trip यानी एक गाड़ी का एक या ज़्यादा LR लेकर निकलना। Trip बनाते ही गाड़ी की journey भी शुरू हो जाती है।",

  "lesson.ops.expenses.title": "Trip के ख़र्च और advance लिखिए",
  "lesson.ops.expenses.warn":
    "Journey बंद होने के बाद डाले गए ख़र्च सुधारना बहुत मुश्किल होता है। Trip चलते-चलते ही entry कीजिए।",

  "lesson.ops.deliver.title": "Delivery मार्क कीजिए और POD चढ़ाइए",
  "lesson.ops.deliver.intro":
    "Delivery में दो काम हैं: LR को delivered मार्क करना, और signed POD upload करना। जब तक POD नहीं आता, Accounts उस LR का bill नहीं बना सकता।",
  "lesson.ops.deliver.warn":
    "POD न होने से bill रुक जाता है। Consignee sign करने से मना करे तो उसी दिन manager को बताइए, pending मत छोड़िए।",
};

/**
 * Lists are translated whole, never line by line. `needs`, the numbered steps
 * and a status flow are positional: an id like `…needs.0` silently points at
 * the wrong line the moment somebody inserts an item. A list here is used
 * only when it has exactly as many entries as the English — otherwise the
 * whole English list is shown, so a reader never sees a scrambled mix.
 *
 *   stage.<stageKey>.needs          string[]
 *   stage.<stageKey>.steps.title    string[]  (one per numbered step)
 *   stage.<stageKey>.steps.detail   string[]
 *   lesson.<stepKey>.needs          string[]
 */
export const HI_LIST: Record<string, readonly string[]> = {
  /* ---------------------------------------------------------------- */
  /* Lessons — ERP basics                                              */
  /* ---------------------------------------------------------------- */
  "lesson.basics.navigation.do.title": [
    "बाएँ menu से कोई module खोलिए",
    "Menu छोटा कीजिए",
    "ऊपर की पट्टी से वापस जाइए",
  ],
  "lesson.basics.navigation.do.detail": [
    "Menu उसी तरह बँटा है जैसे काम चलता है: Masters, Orders, LRs, Trips, Accounts।",
    "ऊपर बाएँ वाला button menu को सिर्फ़ icons जितना कर देता है, जिससे चौड़ी table के लिए जगह बन जाती है।",
    "Page के title के ऊपर दिखने वाली links की लाइन बताती है कि आप कहाँ हैं, और एक स्तर पीछे ले जाती है।",
  ],

  "lesson.basics.my-role.do.title": [
    "अपना role और ज़िम्मेदारियाँ पढ़िए",
    "अपने लिए तय training देखिए",
  ],
  "lesson.basics.my-role.do.detail": [
    "ऊपर वाला हिस्सा बताता है कि आपका role किस चीज़ का ज़िम्मेदार है।",
    "पहले ज़रूरी tracks, फिर वे जो आप तब ले सकते हैं जब कहीं और मदद करते हों।",
  ],

  "lesson.basics.process-map.do.title": [
    "ऊपर से नीचे बहाव देखिए",
    "Highlight को Me पर रखिए",
    "किसी भी step पर click कीजिए",
  ],
  "lesson.basics.process-map.do.detail": [
    "तैयारी, booking, transport, delivery, billing, receipts।",
    "सिर्फ़ आपके अपने steps जगमगाते हैं, जिससे पूरे बहाव में अपना हिस्सा दिख जाता है।",
    "उससे खुलता है कि वहाँ क्या होता है, कौन करता है, और पहले क्या चाहिए।",
  ],

  "lesson.basics.lists.do.title": [
    "Search box में लिखिए",
    "Filters से list छोटी कीजिए",
    "Sort करने के लिए column के नाम पर click कीजिए",
    "बेकार के columns छिपाइए",
  ],
  "lesson.basics.lists.do.detail": [
    "यह पूरी list में ढूँढ़ता है, सिर्फ़ सामने वाले page में नहीं।",
    "Status, branch या date से filter कीजिए और record जल्दी ढूँढ़िए।",
    "दोबारा click कीजिए तो उल्टे क्रम में लग जाएगा।",
    "Columns वाले button से वे columns बंद कीजिए जो रास्ते में आते हैं।",
  ],

  "lesson.basics.notifications.do.title": [
    "ऊपर दाईं तरफ़ की घंटी खोलिए",
    "किसी alert पर click करके record खोलिए",
  ],
  "lesson.basics.notifications.do.detail": [
    "इसमें सिर्फ़ वही alerts दिखती हैं जो आपके लिए हैं, जैसे approval का इंतज़ार करता order।",
    "यह सीधे उसी order, LR या trip पर ले जाती है जिसकी बात है।",
  ],

  "lesson.basics.profile.do.title": [
    "अपना नाम और मोबाइल नंबर जाँचिए",
    "तय कीजिए कि कौन-सी alerts चाहिए",
  ],
  "lesson.basics.profile.do.detail": [
    "आप जो records बनाते हैं, उन पर दूसरों को आपका यही नाम दिखता है।",
    "जो आपके काम की नहीं हैं उन्हें बंद कर दीजिए, ताकि घंटी काम की बनी रहे।",
  ],

  "lesson.basics.glossary.do.title": [
    "Screen पर दिखा कोई शब्द search कीजिए",
    "जब भी कोई शब्द अटकाए, यहाँ लौट आइए",
  ],
  "lesson.basics.glossary.do.detail": [
    "POD, demurrage या TBB लिखकर देखिए। लिखते-लिखते ही list छँटती जाती है।",
    "Training में कठिन शब्दों पर click होता है और वे सीधे glossary पर ले जाते हैं।",
  ],

  /* ---------------------------------------------------------------- */
  /* Lessons — Administration                                          */
  /* ---------------------------------------------------------------- */
  "lesson.admin.users.do.title": [
    "New user दबाइए",
    "उनका नाम, email और मोबाइल भरिए",
    "उनका role चुनिए",
    "उनकी branches तय कीजिए",
  ],
  "lesson.admin.users.do.detail": [
    "Settings → Users खोलिए और New user दबाइए।",
    "Email ही login है। व्यक्ति का अपना work email लीजिए, साझा वाला नहीं।",
    "एक user का एक ही role। कोई role फ़िट न बैठे तो पहले role बनाइए, यहाँ नया मत गढ़िए।",
    "सारी branches, या सिर्फ़ वे जो आप चुनें। यही उन्हें दिखेंगी।",
  ],
  "lesson.admin.users.needs": [
    "व्यक्ति का नाम और work email",
    "ऐसा role जो उनके काम से मेल खाता हो",
  ],

  "lesson.admin.roles.do.title": [
    "Settings → Roles खोलिए",
    "कोई role खोलकर उसकी permissions पढ़िए",
    "कोई permission चालू या बंद कीजिए",
    "देखिए कि यह role किसके पास है",
  ],
  "lesson.admin.roles.do.detail": [
    "Built-in roles हैं: Admin, Branch Manager, Operations, Accounts और Read-Only Auditor।",
    "ये module के हिसाब से बँटी हैं, उन्हीं शब्दों में जो screens पर हैं — Book new orders, Approve bills।",
    "उन सबके बारे में सोचिए जिनके पास यह role है, सिर्फ़ उस एक के बारे में नहीं जिसने कहा है। पक्का हो जाए तब save कीजिए।",
    "Role अपने users दिखाता है, तो पता चल जाता है कि आपका बदलाव किन पर लगेगा।",
  ],
  "lesson.admin.roles.needs": [
    "Roles सँभालने की permission",
    "साफ़ अंदाज़ा कि यह role क्या-क्या कर सके",
  ],

  "lesson.admin.access.do.title": [
    "Settings → Access खोलिए",
    "सारी branches दीजिए, या चुनिए",
    "ज़रूरत हो तभी special permission दीजिए",
  ],
  "lesson.admin.access.do.detail": [
    "जिस user को बदलना है उसे ढूँढ़िए।",
    "Branch के लोगों को आमतौर पर सिर्फ़ अपनी branch मिलती है। मालिक और auditors को आमतौर पर सारी।",
    "सिर्फ़ इसी व्यक्ति के लिए एक permission Allow या Block कीजिए, जब पूरा role बदलना ग़लत हो।",
  ],
  "lesson.admin.access.needs": [
    "User पहले से बना हो",
    "आपको पता हो कि वे असल में किन branches में काम करते हैं",
  ],

  "lesson.admin.notifications.do.title": [
    "Settings → Notifications खोलिए",
    "Event चुनिए",
    "तय कीजिए कि किसे जाए",
  ],
  "lesson.admin.notifications.do.detail": [
    "नियम बताते हैं कि किस घटना की ख़बर किसे दी जाए।",
    "Approval के इंतज़ार में नया order, लेट चल रहा trip, review के इंतज़ार में bill।",
    "किसी नाम के बजाय role को भेजिए, ताकि स्टाफ़ बदलने पर भी चलता रहे।",
  ],

  "lesson.admin.audit-log.do.title": [
    "Settings → Audit log खोलिए",
    "जो ढूँढ़ रहे हैं उस पर filter लगाइए",
    "विस्तार देखने के लिए entry खोलिए",
  ],
  "lesson.admin.audit-log.do.detail": [
    "इसमें record, बदलने वाला, क्या हुआ और कब — सब दिखता है।",
    "व्यक्ति से, date से, या record के प्रकार से।",
    "दिखाता है कि बदलाव से पहले क्या था और बाद में क्या हुआ।",
  ],
  "lesson.admin.audit-log.needs": ["Audit log देखने की permission"],

  /* ---------------------------------------------------------------- */
  /* Lessons — Operations                                              */
  /* ---------------------------------------------------------------- */
  "lesson.ops.masters.do.title": [
    "Customers खोलकर अपना customer ढूँढ़िए",
    "Pickup और delivery की locations जाँचिए",
    "देखिए कि route मौजूद है",
    "Rate matrix में rate जाँचिए",
  ],
  "lesson.ops.masters.do.detail": [
    "नाम से search कीजिए। Customer न मिले तो masters सँभालने वाले से जुड़वाइए — मिलते-जुलते नाम पर booking मत कीजिए।",
    "Customer खोलकर उसकी locations देखिए। Order के from और to पते इसी सूची से चुने जाते हैं।",
    "Route, from branch को to branch से जोड़ता है। Route नहीं तो order नहीं।",
    "Order का भाड़ा इसी rate से निकलता है। Rate न हो तो order का भाड़ा अपने आप नहीं लगेगा।",
  ],
  "lesson.ops.masters.needs": ["कुछ नहीं। सब कुछ यहीं से शुरू होता है।"],

  "lesson.ops.book-order.do.title": [
    "New order दबाइए",
    "Customer और दोनों branches चुनिए",
    "Pickup की तारीख़ और trucks भरिए",
    "Save कीजिए",
  ],
  "lesson.ops.book-order.do.detail": [
    "Orders खोलिए और ऊपर दाईं तरफ़ New order दबाइए।",
    "Customer, from branch, to branch। इन्हीं दो branches से route और उसका rate मिल जाता है।",
    "Pickup की तारीख़, गाड़ी का प्रकार और कितने truck। Weight वाले order में weight भरिए।",
    "Save करते ही यह manager के पास चला जाता है। Order तब तक Pending approval पर रहता है जब तक वे confirm न करें।",
  ],
  "lesson.ops.book-order.needs": [
    "Customer और उसकी pickup तथा delivery locations",
    "दोनों branches के बीच एक route",
    "Rate matrix में उस route का rate",
    "Truck वाले orders के लिए गाड़ी का प्रकार",
  ],

  "lesson.ops.order-status.do.title": [
    "Orders खोलकर status वाला column देखिए",
    "Confirmed होने का इंतज़ार कीजिए",
  ],
  "lesson.ops.order-status.do.detail": [
    "जब तक manager कुछ न करे, आपका order Pending approval दिखाता है।",
    "LR सिर्फ़ Confirmed order से बनते हैं। Rejected दिखे तो खोलकर कारण पढ़िए।",
  ],
  "lesson.ops.order-status.needs": ["आपका book किया हुआ कोई order"],

  "lesson.ops.create-lr.do.title": [
    "Confirmed order खोलकर Make LR दबाइए",
    "भेजने वाला और लेने वाला भरिए",
    "माल जोड़िए और भाड़ा जाँचिए",
    "Finalise कीजिए",
  ],
  "lesson.ops.create-lr.do.detail": [
    "Orders में से वह order ढूँढ़िए जो Confirmed दिखा रहा है। इससे वह LR group बनता है जिसमें LR रहते हैं।",
    "Consignor आमतौर पर वही customer होता है जिसने booking की। Consignee वह है जो दूसरे छोर पर डिलीवरी लेगा — पूरे पते के साथ।",
    "माल का विवरण, पैकेज की संख्या और weight। भाड़ा rate matrix से आता है — बदलिए तभी जब आपकी branch इसकी इजाज़त दे।",
    "LR को number अब ही मिलता है। Draft LR का कोई number नहीं होता और वह trip पर नहीं चढ़ सकता।",
  ],
  "lesson.ops.create-lr.needs": [
    "ऐसा order जिसे manager पहले ही Confirm कर चुका हो",
    "Consignee का नाम और delivery का पता",
    "माल क्या है और उसका weight कितना है",
  ],

  "lesson.ops.ewaybill.do.title": [
    "LR खोलकर e-way bill पर जाइए",
    "नंबर और valid-until तारीख़ भरिए",
    "Part-B में गाड़ी नंबर भरिए",
  ],
  "lesson.ops.ewaybill.do.detail": [
    "E-way bill उसी LR से जोड़िए जिसका वह है, order से नहीं।",
    "कस्टमर का दिया नंबर और उसके expire होने की तारीख़ लिखिए।",
    "Part-B यानी गाड़ी। Truck निकलने से पहले यह भरना ज़रूरी है, और रास्ते में गाड़ी बदले तो update भी करना है।",
  ],
  "lesson.ops.ewaybill.needs": [
    "Finalise हो चुका LR",
    "कस्टमर से मिला e-way bill नंबर",
    "गाड़ी का नंबर",
  ],

  "lesson.ops.trip.do.title": [
    "New trip दबाइए",
    "गाड़ी और ड्राइवर चुनिए",
    "जो LR जा रहे हैं वे जोड़िए",
    "Save करके journey शुरू कीजिए",
  ],
  "lesson.ops.trip.do.detail": [
    "Trips खोलिए और New trip दबाइए।",
    "अपनी गाड़ी या market vehicle। Market vehicle के लिए उसका मालिक और hire rate भी चाहिए।",
    "सिर्फ़ finalise हो चुके LR ही जोड़े जा सकते हैं। एक trip कई LR ले जा सकता है।",
    "शुरू के kilometre भरिए, ताकि बाद में journey ठीक से बंद हो सके।",
  ],
  "lesson.ops.trip.needs": [
    "लादने के लिए finalise हो चुके LR",
    "एक गाड़ी और एक ड्राइवर",
    "शुरू का kilometre reading",
  ],

  "lesson.ops.expenses.do.title": [
    "Trip खोलकर Expenses पर जाइए",
    "डीज़ल, toll और बाक़ी ख़र्च भरिए",
    "ड्राइवर को दिया नकद लिखिए",
  ],
  "lesson.ops.expenses.do.detail": [
    "ख़र्च जैसे-जैसे होते हैं वैसे ही भरिए, महीने के आख़िर में एक साथ नहीं।",
    "हर line में रक़म और किस चीज़ का ख़र्च था, दोनों चाहिए। Bill हो तो जोड़ दीजिए।",
    "ड्राइवर के advance भी यहीं लिखे जाते हैं, ताकि आख़िर में trip का हिसाब बराबर बैठे।",
  ],
  "lesson.ops.expenses.needs": ["ऐसा trip जो शुरू हो चुका हो"],

  "lesson.ops.deliver.do.title": [
    "Deliveries खोलकर LR ढूँढ़िए",
    "उसे delivered मार्क कीजिए",
    "Signed POD upload कीजिए",
  ],
  "lesson.ops.deliver.do.detail": [
    "Delivery पर निकले LR यहाँ अपने trip के साथ दिखते हैं।",
    "वह तारीख़ और समय भरिए जब consignee ने असल में माल लिया।",
    "Pending POD tab पर जाइए और consignee के sign किए POD का फ़ोटो या scan चढ़ाइए।",
  ],
  "lesson.ops.deliver.needs": [
    "कोई LR जो trip पर है",
    "Consignee का sign किया हुआ POD",
  ],
};
