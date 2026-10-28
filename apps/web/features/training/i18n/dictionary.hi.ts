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
  // Nothing yet — the stage and lesson batches come after the glossary
  // vocabulary above has been confirmed by branch staff.
};
