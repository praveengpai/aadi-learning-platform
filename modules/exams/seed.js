'use strict';
// Demo seed for the exams module: 6 months of activity for youth in exam programmes, plus a rich
// journey for demo.youth (PSC aspirant, hamlet h2). All calendar entries are DEMO (fictional
// notification numbers); current-affairs items are generic explainers, not news claims.

const AFFAIRS = [
  ['explainer', 'What is One-Time Registration (OTR) on the Kerala PSC portal?', 'PSC ഒറ്റത്തവണ രജിസ്ട്രേഷൻ എന്താണ്?', 'Before applying for any Kerala PSC post you create one profile with your photo, signature, education and ID. After that, each application is a few clicks. Keep your user ID and password safe and never share your OTP.', 'ഏതു പി.എസ്.സി തസ്തികയ്ക്കും അപേക്ഷിക്കുന്നതിനുമുമ്പ് ഫോട്ടോ, ഒപ്പ്, വിദ്യാഭ്യാസ വിവരങ്ങൾ എന്നിവയോടെ ഒരു പ്രൊഫൈൽ ഉണ്ടാക്കണം. പാസ്‌വേഡും OTP-യും ആരോടും പങ്കിടരുത്.', ['psc', 'how-to']],
  ['explainer', 'What is a "confirmation" in Kerala PSC exams?', 'പി.എസ്.സി "കൺഫർമേഷൻ" എന്താണ്?', 'For many PSC exams, candidates must confirm within the given window that they will write the exam. If you do not confirm, you may not get a hall ticket. Mark the confirmation dates in your AADI calendar.', 'പല പി.എസ്.സി പരീക്ഷകൾക്കും നിശ്ചിത സമയത്തിനുള്ളിൽ പരീക്ഷ എഴുതുമെന്ന് ഉറപ്പ് നൽകണം. അല്ലെങ്കിൽ ഹാൾ ടിക്കറ്റ് ലഭിക്കില്ല.', ['psc', 'how-to']],
  ['explainer', 'Negative marking: when should you leave a question blank?', 'നെഗറ്റീവ് മാർക്ക്: എപ്പോൾ ഉത്തരം വിടണം?', 'Kerala PSC deducts one-third of a mark for each wrong answer. If you can rule out two options, guessing between the remaining two is usually worth it. If you have no idea, leave it blank.', 'പി.എസ്.സിയിൽ ഓരോ തെറ്റിനും മൂന്നിലൊന്ന് മാർക്ക് കുറയും. രണ്ട് ഓപ്ഷനുകൾ ഒഴിവാക്കാൻ കഴിഞ്ഞാൽ ഊഹിക്കാം; ഒന്നും അറിയില്ലെങ്കിൽ വിട്ടേക്കുക.', ['strategy']],
  ['explainer', 'How to fill an OMR answer sheet correctly', 'OMR ഷീറ്റ് ശരിയായി പൂരിപ്പിക്കുന്ന വിധം', 'Use only a blue or black ball-point pen. Fill the bubble completely, do not tick or cross. One bubble per question. Do not fold the sheet. Write your register number carefully and shade the matching bubbles.', 'നീല/കറുപ്പ് ബോൾ പോയിന്റ് പേന മാത്രം. വൃത്തം മുഴുവനായി കറുപ്പിക്കുക. ടിക്കോ ക്രോസോ അരുത്. രജിസ്റ്റർ നമ്പർ ശ്രദ്ധയോടെ എഴുതുക.', ['omr', 'strategy']],
  ['explainer', 'DigiLocker: keep your certificates safe on your phone', 'ഡിജിലോക്കർ: സർട്ടിഫിക്കറ്റുകൾ ഫോണിൽ', 'DigiLocker is a Government of India app where you can store and fetch documents like your SSLC marks list, Aadhaar and driving licence. Documents fetched from the issuer are valid as originals for many purposes.', 'എസ്.എസ്.എൽ.സി, ആധാർ തുടങ്ങിയ രേഖകൾ സൂക്ഷിക്കാനുള്ള കേന്ദ്ര സർക്കാർ ആപ്പാണ് ഡിജിലോക്കർ.', ['documents']],
  ['explainer', 'Community certificate: why ST candidates must keep it updated', 'ജാതി സർട്ടിഫിക്കറ്റ് പുതുക്കി സൂക്ഷിക്കുക', 'ST reservation and age relaxation need a valid community certificate from the Village Office / Tahsildar. Apply early — at verification time you must show the original.', 'സംവരണത്തിനും പ്രായ ഇളവിനും വില്ലേജ് ഓഫീസിൽ നിന്നുള്ള സാധുവായ ജാതി സർട്ടിഫിക്കറ്റ് വേണം. നേരത്തെ അപേക്ഷിക്കുക.', ['documents', 'st']],
  ['explainer', 'Age relaxation for Scheduled Tribe candidates', 'പട്ടികവർഗക്കാർക്ക് പ്രായ ഇളവ്', 'Most government recruitments give extra years in the upper age limit to SC/ST candidates. The exact relaxation is written in each notification — always read the "Age" section.', 'മിക്ക നിയമനങ്ങളിലും SC/ST വിഭാഗത്തിന് ഉയർന്ന പ്രായപരിധിയിൽ ഇളവുണ്ട്. ഓരോ വിജ്ഞാപനത്തിലും കൃത്യമായി വായിക്കുക.', ['st', 'eligibility']],
  ['explainer', 'What is a hall ticket (admit card)?', 'ഹാൾ ടിക്കറ്റ് എന്താണ്?', 'A hall ticket shows your register number, exam centre and time. Download it from your profile a few days before the exam, print it, and carry it with an original photo ID.', 'രജിസ്റ്റർ നമ്പർ, പരീക്ഷാകേന്ദ്രം, സമയം എന്നിവ കാണിക്കുന്ന രേഖ. പ്രിന്റ് എടുത്ത് ഒറിജിനൽ ഐ.ഡിയോടൊപ്പം കൊണ്ടുപോകുക.', ['how-to']],
  ['explainer', 'Bank exams: IBPS Clerk vs IBPS PO in one minute', 'IBPS ക്ലർക്കും PO-യും', 'Both are conducted by IBPS for public sector banks. Clerk needs a degree and is a customer-service post; PO also needs a degree but has an interview and leads to officer roles. Both have prelims with English, Numerical Ability and Reasoning.', 'രണ്ടിനും ബിരുദം വേണം. ക്ലർക്ക് ഉപഭോക്തൃസേവന തസ്തിക; PO ഓഫീസർ തസ്തിക, ഇന്റർവ്യൂ ഉണ്ട്.', ['bank']],
  ['explainer', 'SSC GD Constable: who can apply?', 'SSC ജി.ഡി: ആർക്കൊക്കെ അപേക്ഷിക്കാം?', 'SSC GD recruits constables to central armed police forces. Usually the minimum qualification is a pass in Class 10, followed by a computer-based test, a physical test and a medical test.', 'കേന്ദ്ര സായുധ പോലീസ് സേനകളിലേക്കുള്ള നിയമനം. സാധാരണയായി പത്താം ക്ലാസ് യോഗ്യത, തുടർന്ന് കമ്പ്യൂട്ടർ പരീക്ഷ, കായികക്ഷമതാ പരീക്ഷ.', ['ssc']],
  ['explainer', 'Physical efficiency test: start training months early', 'കായികക്ഷമതാ പരീക്ഷ: നേരത്തെ പരിശീലിക്കുക', 'Police and forest posts include running, long jump and other events. Train 4 days a week, eat well, and practise on proper ground. AADI youth circles organise group runs on Sunday mornings.', 'പോലീസ്, ഫോറസ്റ്റ് തസ്തികകൾക്ക് ഓട്ടം, ലോങ് ജമ്പ് തുടങ്ങിയവ. ആഴ്ചയിൽ 4 ദിവസം പരിശീലിക്കുക.', ['police', 'forest']],
  ['explainer', 'Beat Forest Officer: a job close to home', 'ബീറ്റ് ഫോറസ്റ്റ് ഓഫീസർ', 'Forest Department posts value knowledge of the forest. Kerala PSC has run special recruitment for Scheduled Tribe candidates from forest areas for some posts — watch for such notifications.', 'വനപരിജ്ഞാനത്തിന് മൂല്യമുള്ള തസ്തിക. വനമേഖലയിലെ പട്ടികവർഗക്കാർക്കായി പ്രത്യേക നിയമനങ്ങൾ ശ്രദ്ധിക്കുക.', ['forest', 'st']],
  ['explainer', 'e-Grantz: scholarships for ST students in Kerala', 'ഇ-ഗ്രാന്റ്സ്: പട്ടികവർഗ വിദ്യാർത്ഥികൾക്ക്', 'Kerala routes post-matric educational assistance for SC/ST students through the e-Grantz system. Your institution starts the application — check with the office that your bank account is linked.', 'പോസ്റ്റ്-മെട്രിക് വിദ്യാഭ്യാസ സഹായം ഇ-ഗ്രാന്റ്സ് വഴിയാണ്. ബാങ്ക് അക്കൗണ്ട് ലിങ്ക് ചെയ്തിട്ടുണ്ടോ എന്ന് ഉറപ്പാക്കുക.', ['scholarship', 'st']],
  ['explainer', 'Beware of fake job offers and "pay to get selected" calls', 'വ്യാജ ജോലി വാഗ്ദാനങ്ങൾ സൂക്ഷിക്കുക', 'No genuine government recruitment asks for money to "confirm" a job. Apply only on official websites. If someone asks for an OTP or a fee on WhatsApp, report it on 1930.', 'യഥാർത്ഥ സർക്കാർ നിയമനത്തിന് പണം ആവശ്യപ്പെടില്ല. OTP ചോദിച്ചാൽ 1930-ൽ റിപ്പോർട്ട് ചെയ്യുക.', ['safety']],
  ['explainer', 'Rank list, shortlist and advice memo — what they mean', 'റാങ്ക് ലിസ്റ്റ്, ഷോർട്ട്‌ലിസ്റ്റ്, അഡ്വൈസ് മെമ്മോ', 'After the exam, PSC publishes a shortlist for verification, then a rank list. Appointments are advised from the rank list as vacancies are reported. A rank list usually stays valid for a fixed period.', 'പരീക്ഷയ്ക്കുശേഷം ഷോർട്ട്‌ലിസ്റ്റ്, പിന്നീട് റാങ്ക് ലിസ്റ്റ്. ഒഴിവുകൾ റിപ്പോർട്ട് ചെയ്യുന്ന മുറയ്ക്ക് നിയമന ശുപാർശ.', ['psc']],
  ['explainer', 'Study plan: 45 minutes a day beats 5 hours on Sunday', 'ദിവസം 45 മിനിറ്റ്', 'Short daily practice and spaced revision help memory more than long, rare sessions. Use the AADI revision queue every day — it shows only the questions you are about to forget.', 'ദിവസേനയുള്ള ചെറിയ പരിശീലനവും ഇടവിട്ടുള്ള റിവിഷനുമാണ് ഓർമ്മയ്ക്ക് നല്ലത്.', ['strategy']],
  ['explainer', 'Kerala Renaissance: five names every aspirant must know', 'നവോത്ഥാന നായകർ', 'Sree Narayana Guru, Ayyankali, Chattampi Swamikal, Mannathu Padmanabhan and Vakkom Moulavi appear again and again in PSC papers. Learn one fact about each from the AADI question bank this week.', 'ശ്രീനാരായണ ഗുരു, അയ്യങ്കാളി, ചട്ടമ്പിസ്വാമികൾ, മന്നത്ത് പത്മനാഭൻ, വക്കം മൗലവി — ഓരോരുത്തരെക്കുറിച്ചും ഒരു വസ്തുത.', ['kerala', 'gk']],
  ['explainer', 'Constitution corner: Fifth Schedule and tribal self-rule', 'ഭരണഘടന: അഞ്ചാം പട്ടിക', 'The Fifth Schedule covers administration of Scheduled Areas. PESA (1996) and the Forest Rights Act (2006) give gram sabhas a voice. These are frequent exam topics — and your rights.', 'അഞ്ചാം പട്ടിക, പെസ (1996), വനാവകാശ നിയമം (2006) — പരീക്ഷയ്ക്കും നിങ്ങളുടെ അവകാശങ്ങൾക്കും.', ['polity', 'st']],
  ['explainer', 'UPI safety before you pay an application fee', 'അപേക്ഷാ ഫീസ് അടയ്ക്കുമ്പോൾ', 'Pay fees only on the official portal\'s payment page. Never pay to a personal UPI ID someone sends you. Take a screenshot of the receipt and save it to DigiLocker or your AADI documents.', 'ഔദ്യോഗിക പോർട്ടലിൽ മാത്രം ഫീസ് അടയ്ക്കുക. വ്യക്തിഗത UPI ഐ.ഡിയിലേക്ക് പണം അയയ്ക്കരുത്.', ['safety', 'digital']],
  ['explainer', 'Railway (RRB) Group D: what the exam covers', 'RRB ഗ്രൂപ്പ് ഡി', 'Mathematics, general intelligence and reasoning, general science and general awareness, followed by a physical efficiency test. Practise with the AADI RRB pattern.', 'ഗണിതം, റീസണിംഗ്, ശാസ്ത്രം, പൊതുവിജ്ഞാനം; തുടർന്ന് കായികക്ഷമതാ പരീക്ഷ.', ['rrb']],
  ['explainer', 'Interview tip: introduce yourself in 60 seconds', 'ഇന്റർവ്യൂ: 60 സെക്കൻഡിൽ സ്വയം പരിചയപ്പെടുത്തൽ', 'Name, place, education, one strength, one reason you want this job. Practise it in English and Malayalam in the AADI Language module\'s speaking lab.', 'പേര്, സ്ഥലം, വിദ്യാഭ്യാസം, ഒരു കഴിവ്, ഈ ജോലി എന്തിന് — ഇംഗ്ലീഷിലും മലയാളത്തിലും പരിശീലിക്കുക.', ['interview']],
  ['explainer', 'Science corner: why we must remove stagnant water', 'ശാസ്ത്രം: കെട്ടിക്കിടക്കുന്ന വെള്ളം', 'Aedes mosquitoes, which spread dengue, breed in small pools of clean water — coconut shells, tyres, pots. Questions on vector-borne diseases are common in PSC science sections.', 'ഡെങ്കി പരത്തുന്ന ഈഡിസ് കൊതുകുകൾ ചിരട്ട, ടയർ തുടങ്ങിയവയിലെ വെള്ളത്തിൽ മുട്ടയിടുന്നു.', ['science']],
  ['explainer', 'Geography corner: the 44 rivers of Kerala', 'കേരളത്തിലെ 44 നദികൾ', '41 rivers flow west to the Arabian Sea and 3 — Kabani, Bhavani and Pambar — flow east. Periyar is the longest. Our own hamlets sit on the catchments of several of these rivers.', '41 നദികൾ പടിഞ്ഞാറോട്ടും 3 എണ്ണം (കബനി, ഭവാനി, പാമ്പാർ) കിഴക്കോട്ടും ഒഴുകുന്നു.', ['kerala', 'geography']],
  ['explainer', 'Exam day checklist', 'പരീക്ഷാ ദിവസ ചെക്ക്‌ലിസ്റ്റ്', 'Hall ticket, original photo ID, two blue/black ball-point pens, water, bus fare and the route to the centre. Reach at least one hour early — gates close on time.', 'ഹാൾ ടിക്കറ്റ്, ഒറിജിനൽ ഐ.ഡി, രണ്ട് പേന, വെള്ളം, ബസ് കൂലി. ഒരു മണിക്കൂർ മുമ്പ് എത്തുക.', ['how-to']],
  ['explainer', 'Reading a notification: the five boxes to check', 'വിജ്ഞാപനം വായിക്കുമ്പോൾ', 'Qualification, age limit (with relaxation), last date, mode of selection, and whether it is a district-wise or state-wise post. AADI facilitators can read it with you.', 'യോഗ്യത, പ്രായപരിധി, അവസാന തീയതി, തിരഞ്ഞെടുപ്പ് രീതി, ജില്ലാതല/സംസ്ഥാനതല തസ്തിക.', ['how-to']],
  ['explainer', 'English corner: "since" vs "for"', 'ഇംഗ്ലീഷ്: since / for', 'Use "since" with a point in time (since 2020, since Monday) and "for" with a length of time (for five years, for two hours). This appears in almost every General English section.', '"since" ഒരു സമയബിന്ദുവിനൊപ്പം, "for" ഒരു കാലയളവിനൊപ്പം.', ['english']],
  ['explainer', 'Maths corner: percentages in 10 seconds', 'ശതമാനം 10 സെക്കൻഡിൽ', '10% = divide by 10. 5% = half of 10%. 25% = divide by 4. 50% = half. Build any percentage from these blocks: 15% = 10% + 5%.', '10% = 10 കൊണ്ട് ഹരിക്കുക; 5% = അതിന്റെ പകുതി; 25% = 4 കൊണ്ട് ഹരിക്കുക.', ['quant']],
  ['explainer', 'Free coaching options for ST youth', 'പട്ടികവർഗ യുവാക്കൾക്ക് സൗജന്യ പരിശീലനം', 'Government departments and NGOs run free or stipend-supported coaching for PSC and other exams. Your AADI facilitator keeps a list of current options for your district.', 'സർക്കാർ വകുപ്പുകളും സന്നദ്ധ സംഘടനകളും സൗജന്യ പരിശീലനം നൽകുന്നു. വിവരങ്ങൾക്ക് ഫെസിലിറ്റേറ്ററെ സമീപിക്കുക.', ['st', 'coaching']],
  ['explainer', 'Mother tongue is a strength', 'മാതൃഭാഷ ഒരു ശക്തിയാണ്', 'Knowing a tribal language plus Malayalam and English is valuable for forest, health, police and tourism jobs that serve tribal areas. Mention it in interviews.', 'ഗോത്രഭാഷയും മലയാളവും ഇംഗ്ലീഷും അറിയുന്നത് വനം, ആരോഗ്യം, പോലീസ് ജോലികളിൽ ഗുണം ചെയ്യും.', ['interview', 'language']],
  ['explainer', 'Revision before the exam: the last 7 days', 'അവസാന 7 ദിവസത്തെ റിവിഷൻ', 'No new topics. Clear your AADI revision queue daily, write one full mock on day 5, rest well the night before, and travel light.', 'പുതിയ വിഷയങ്ങൾ വേണ്ട. ദിവസവും റിവിഷൻ, അഞ്ചാം ദിവസം ഒരു മോക്ക്, തലേന്ന് നന്നായി ഉറങ്ങുക.', ['strategy']],
];

function seedAll(ctx, demo, { L, finishAttempt, STEP_IDS, DOC_LIST }) {
  const { data, tx, brain, sql } = ctx;
  const { R, daysAgo } = demo;
  const iso = (d) => d.toISOString().slice(0, 10);
  const inDays = (n) => iso(new Date(Date.now() + n * 86400e3));
  const teacher = demo.users.teacher;

  tx(() => {
    for (const [code, domain, title, title_ml, level, stage] of L.NEW_COMPETENCIES) brain.competencies.upsert({ id: 'cmp_' + code.toLowerCase().replace(/\./g, '_'), code, domain, title, title_ml, level, stage });

    // current affairs: ~30 items over the last ~10 weeks
    AFFAIRS.forEach(([category, title, title_ml, body, body_ml, tags], i) => data.put('exams_affairs', { date: daysAgo(Math.round(i * 2.3) + 1).slice(0, 10), category, title, title_ml, body, body_ml, tags, author: 'AADI content team (demo)', demo: 1 }, null));

    // exam calendar — DEMO notifications (fictional category numbers)
    const C = (o) => data.put('exams_calendar', { demo: 1, url: null, ...o }, null);
    demo._cal = {
      cpo: C({ code: 'DEMO-CAT 101/2026', body: 'psc', title: 'Civil Police Officer — Special Recruitment for ST (demo)', title_ml: 'സിവിൽ പോലീസ് ഓഫീസർ — ST പ്രത്യേക നിയമനം (ഡെമോ)', notif_date: inDays(-20), apply_from: inDays(-20), apply_by: inDays(9), exam_date: inDays(75), pattern: 'psc_cpo', eligibility: 'SSLC pass; ST candidates from notified areas; physical standards apply', eligibility_ml: 'എസ്.എസ്.എൽ.സി; ST; ശാരീരിക യോഗ്യതകൾ ബാധകം' }),
      ldc: C({ code: 'DEMO-CAT 088/2026', body: 'psc', title: 'LDC (Clerk) — various departments (demo)', title_ml: 'എൽ.ഡി. ക്ലർക്ക് (ഡെമോ)', notif_date: inDays(-110), apply_from: inDays(-110), apply_by: inDays(-70), exam_date: inDays(18), pattern: 'psc_ldc', eligibility: 'SSLC pass, age 18–36 (relaxation for SC/ST)', eligibility_ml: 'എസ്.എസ്.എൽ.സി; പ്രായം 18–36 (SC/ST ഇളവ്)' }),
      bfo: C({ code: 'DEMO-CAT 117/2026', body: 'psc', title: 'Beat Forest Officer — tribal special recruitment (demo)', title_ml: 'ബീറ്റ് ഫോറസ്റ്റ് ഓഫീസർ — ഗോത്ര പ്രത്യേക നിയമനം (ഡെമോ)', notif_date: inDays(-5), apply_from: inDays(-5), apply_by: inDays(25), exam_date: inDays(110), pattern: 'psc_bfo', eligibility: 'Plus Two pass; ST from forest-fringe settlements', eligibility_ml: 'പ്ലസ് ടു; വനാതിർത്തി ST' }),
      lgs: C({ code: 'DEMO-CAT 052/2026', body: 'psc', title: 'Last Grade Servants (demo)', title_ml: 'ലാസ്റ്റ് ഗ്രേഡ് സർവന്റ്സ് (ഡെമോ)', notif_date: inDays(-200), apply_from: inDays(-200), apply_by: inDays(-170), exam_date: inDays(-40), pattern: 'psc_lgs', eligibility: 'Class 7 pass; not a graduate', eligibility_ml: 'ഏഴാം ക്ലാസ്; ബിരുദധാരിയല്ലാത്തവർ' }),
      pre10: C({ code: 'DEMO-CAT 140/2026', body: 'psc', title: '10th Level Preliminary Exam — stage 1 (demo)', title_ml: 'പത്താം തല പ്രിലിമിനറി (ഡെമോ)', notif_date: inDays(12), apply_from: inDays(12), apply_by: inDays(42), exam_date: inDays(140), pattern: 'psc_pre10', eligibility: 'SSLC pass', eligibility_ml: 'എസ്.എസ്.എൽ.സി' }),
      ibps: C({ code: 'DEMO-IBPS-CL', body: 'bank', title: 'IBPS Clerk — prelims (demo dates)', title_ml: 'IBPS ക്ലർക്ക് (ഡെമോ)', notif_date: inDays(-15), apply_from: inDays(-15), apply_by: inDays(5), exam_date: inDays(55), pattern: 'ibps_clerk', eligibility: 'Any degree; age 20–28 (relaxation for SC/ST)', eligibility_ml: 'ബിരുദം; പ്രായം 20–28 (SC/ST ഇളവ്)' }),
      gd: C({ code: 'DEMO-SSC-GD', body: 'ssc', title: 'SSC GD Constable (demo dates)', title_ml: 'SSC ജി.ഡി. കോൺസ്റ്റബിൾ (ഡെമോ)', notif_date: inDays(-30), apply_from: inDays(-30), apply_by: inDays(-2), exam_date: inDays(60), pattern: 'ssc_gd', eligibility: 'Class 10 pass; age 18–23 (relaxation for SC/ST)', eligibility_ml: 'പത്താം ക്ലാസ്; പ്രായം 18–23' }),
      rrb: C({ code: 'DEMO-RRB-D', body: 'rrb', title: 'RRB Group D (demo dates)', title_ml: 'RRB ഗ്രൂപ്പ് ഡി (ഡെമോ)', notif_date: inDays(20), apply_from: inDays(20), apply_by: inDays(50), exam_date: inDays(160), pattern: 'rrb_groupd', eligibility: 'Class 10 / ITI', eligibility_ml: 'പത്താം ക്ലാസ് / ഐ.ടി.ഐ' }),
    };
  });

  // learners in exam programmes
  const examProgs = demo.programmes.filter((p) => p.track === 'exams');
  const learners = new Map(); // pid -> {person, progs[]}
  for (const pr of examProgs) for (const p of demo.enrolledIn(pr.id)) { if (p.kind === 'child') continue; const x = learners.get(p.id) || { p, progs: [] }; x.progs.push(pr); learners.set(p.id, x); }
  const dy = demo.demoYouth;
  if (!learners.has(dy.id)) learners.set(dy.id, { p: dy, progs: examProgs.filter((pr) => pr.hamlet_id === dy.hamlet_id) });

  // Simulated answering: P(correct) grows with ability; harder questions are harder.
  const bank = L.BANK;
  const byId = Object.fromEntries(bank.map((q) => [q.id, q]));
  const subjSkill = (base) => Object.fromEntries(Object.keys(L.SUBJECTS).map((s) => [s, base + (R.rnd() - 0.5) * 0.3]));
  function answerSheet(qids, skill, boost) {
    return qids.map((it) => {
      const q = byId[it.qid];
      const p = Math.min(0.95, Math.max(0.12, (skill[q.subject] ?? 0.5) + boost - (q.difficulty - 1) * 0.08));
      if (R.rnd() < p) return q.answer;
      if (R.rnd() < 0.35) return null; // blank (negative-marking aware)
      return (q.answer + R.int(1, 3)) % 4;
    });
  }
  function simAttempt(person, patId, at, skill, boost, extra = {}) {
    let pattern = L.PATTERN[patId], qids;
    if (patId === 'practice') {
      const subj = extra.subject || R.pick(Object.keys(L.SUBJECTS));
      qids = L.shuffle(bank.filter((q) => q.subject === subj), R.rnd).slice(0, 10).map((q) => ({ qid: q.id, section: q.subject }));
      pattern = { id: 'practice', minutes: 10 };
      extra = { ...extra, subject: subj, title: `Practice · ${L.SUBJECTS[subj].label}` };
    } else qids = L.buildPaper(pattern, bank, { rnd: R.rnd });
    const started = new Date(at.getTime() - (pattern.minutes || 10) * 60e3 * (0.7 + R.rnd() * 0.3));
    let answers = answerSheet(qids, skill, boost);
    if (extra.target !== undefined && L.PATTERN[patId]) {
      // demo storyline: of a few simulated sittings, keep the one closest to the target curve
      let best = answers, bestD = Math.abs(L.score(L.PATTERN[patId], qids, answers, byId).pct - extra.target);
      for (let k = 0; k < 8 && bestD > 2; k++) { const alt = answerSheet(qids, skill, boost); const d = Math.abs(L.score(L.PATTERN[patId], qids, alt, byId).pct - extra.target); if (d < bestD) { best = alt; bestD = d; } }
      answers = best;
    }
    const a = data.put('exams_attempts', { person_id: person.id, hamlet_id: person.hamlet_id, pattern: patId, title: extra.title || pattern.title, assignment_id: extra.assignment_id || null, programme_id: extra.programme_id || null, qids, answers: [], status: 'in_progress', started_at: started.toISOString(), neg: pattern.neg || 0, subject: extra.subject || null }, null);
    return finishAttempt(a, answers, null, { at: at.toISOString(), silent: true });
  }

  tx(() => {
    // assignments per exam programme (by a teacher of that agency; the teacher name is generic)
    const assignByProg = {};
    for (const pr of examProgs) {
      const list = [];
      [[130, 'psc_mini', 'Weekly mini mock — GK focus'], [75, 'psc_ldc', 'Full LDC mock #1'], [35, 'psc_mini', 'Mini mock — arithmetic & reasoning'], [12, 'psc_cpo', 'Full CPO mock — before notification'], [-5, 'psc_mini', 'This week\'s mini mock']].forEach(([ago, pat, title]) => {
        const pt = L.PATTERN[pat];
        list.push(data.put('exams_assignments', { agency_id: pr.agency_id, programme_id: pr.id, hamlet_id: pr.hamlet_id, pattern: pat, title, title_ml: pt.title_ml, due: ago < 0 ? inDays(-ago) : daysAgo(ago - 7).slice(0, 10), created_by: pr.agency_id === teacher.agency_id ? teacher.display_name : 'Batch teacher (demo)', created_at: daysAgo(Math.max(ago, 1)) }, null));
      });
      assignByProg[pr.id] = list;
    }

    for (const { p, progs } of learners.values()) {
      const isDemo = p.id === dy.id;
      const base = isDemo ? 0.38 : 0.3 + R.rnd() * 0.3;
      const skill = subjSkill(base);
      if (isDemo) { skill.quant -= 0.12; skill.english -= 0.08; skill.kerala += 0.08; skill.polity -= 0.05; }
      const gain = isDemo ? 0.26 : R.rnd() * 0.2;
      const start = isDemo ? 175 : R.int(60, 170);
      const sessions = isDemo ? 22 : R.int(3, 9);
      const prog = progs[0];
      const assigns = (assignByProg[prog?.id] || []).filter((a) => a.due <= iso(new Date()) || isDemo);
      for (let i = 0; i < sessions; i++) {
        const ago = Math.round(start - (start - 1) * (i / Math.max(1, sessions - 1)));
        const at = new Date(Date.now() - ago * 86400e3 + R.int(9, 19) * 3600e3 - 12 * 3600e3);
        const boost = gain * (i / Math.max(1, sessions - 1));
        let pat;
        if (isDemo) pat = i % 3 === 1 ? 'practice' : (i % 6 === 0 ? 'psc_ldc' : i % 6 === 3 ? 'psc_cpo' : 'psc_mini');
        else pat = R.chance(0.45) ? 'practice' : R.chance(0.75) ? 'psc_mini' : (prog && demo.agencies.find((a) => a.id === prog.agency_id)?.name.includes('Sahyadri') ? R.pick(['ssc_gd', 'psc_cpo']) : R.pick(['psc_ldc', 'psc_lgs', 'psc_cpo', 'ibps_mini']));
        const asg = assigns.find((a) => a.pattern === pat && Math.abs(new Date(a.due) - at) < 14 * 86400e3);
        const extra = { programme_id: prog?.id, assignment_id: asg?.id };
        if (isDemo && pat === 'practice') extra.subject = R.pick(['quant', 'english', 'polity', 'quant']);
        if (isDemo && pat !== 'practice') extra.target = 24 + 36 * (i / (sessions - 1)) + (i % 2 ? -3 : 2);
        simAttempt(p, pat, at, skill, boost, extra);
      }
      if (R.chance(isDemo ? 1 : 0.6)) data.put('exams_prefs', { person_id: p.id, hamlet_id: p.hamlet_id, leaderboard: isDemo || R.chance(0.7) ? 1 : 0, target_exam: isDemo ? 'psc_cpo' : R.pick(['psc_ldc', 'psc_cpo', 'psc_lgs', 'ssc_gd', 'ibps_clerk']), daily_goal: R.pick([10, 15, 20]) }, null);

      // applications
      const cal = demo._cal;
      const mkApp = (c, status, extra = {}) => {
        const idx = STEP_IDS.indexOf(status);
        const steps = {};
        STEP_IDS.slice(0, idx + 1).forEach((s, k) => { steps[s] = daysAgo(Math.max(1, 60 - k * 10)).slice(0, 10); });
        const docs = Object.fromEntries(DOC_LIST.map((d, k) => [d.id, idx >= 1 || k < 3]));
        return data.put('exams_applications', { person_id: p.id, hamlet_id: p.hamlet_id, calendar_id: c.id, status, steps, docs, remind: 1, assisted_by: R.chance(0.6) ? 'Suresh — Facilitator, Thenmala (CIF)' : null, ...extra }, null);
      };
      if (isDemo) {
        mkApp(cal.ldc, 'hall_ticket', { application_no: 'DEMO-88-004213', note: 'Centre: Govt HSS (demo). Bus at 6:10 am.', assisted_by: 'Suresh — Facilitator, Thenmala (CIF)' });
        const cpo = mkApp(cal.cpo, 'docs_ready', { note: 'Community certificate renewed. Apply this week with facilitator.' });
        data.put('exams_applications', { ...cpo, docs: { sslc: true, community: true, aadhaar: true, photo: true, profile: true, email: false } }, null);
        mkApp(cal.lgs, 'result', { application_no: 'DEMO-52-019877', note: 'Wrote the exam; not shortlisted this time — score improving.' });
        mkApp(cal.bfo, 'interested');
        brain.notify(p.id, `AADI reminder: ${cal.cpo.title} — last date to apply is ${cal.cpo.apply_by}. / അപേക്ഷിക്കേണ്ട അവസാന തീയതി ${cal.cpo.apply_by}.`, { channel: 'auto' }, null);
      } else if (R.chance(0.5)) {
        mkApp(R.pick([cal.ldc, cal.cpo, cal.gd, cal.lgs]), R.pick(['interested', 'docs_ready', 'applied', 'applied', 'hall_ticket']));
      }
    }
  });

  // Simulate that learners have been doing their daily revision: older cards were reviewed
  // (SM-2 forward), leaving a realistic handful due today. Demo youth keeps ~14 due.
  const reviews = sql('SELECT * FROM exams_reviews WHERE deleted=0 ORDER BY person_id, lapses DESC, last_seen');
  const byPerson = {};
  for (const r of reviews) (byPerson[r.person_id] = byPerson[r.person_id] || []).push(r);
  const today = iso(new Date());
  tx(() => {
    for (const [pid, list] of Object.entries(byPerson)) {
      const keepDue = pid === dy.id ? 14 : R.int(3, 12);
      list.forEach((r, i) => {
        if (i < keepDue) { if (r.due > today || r.due < inDays(-3)) data.put('exams_reviews', { ...r, due: inDays(-R.int(0, 2)) }, null); return; }
        let st = { ...r }; let t = new Date(r.last_seen).getTime();
        let guard = 0;
        while (guard++ < 8) {
          const next = t + Math.max(1, st.interval_d || 1) * 86400e3;
          if (next > Date.now()) break;
          st = { ...st, ...L.sm2(st, R.chance(0.8) ? R.pick([4, 4, 5]) : 2, next) }; t = next;
        }
        if (st.due <= today) st = { ...st, due: inDays(R.int(1, 10)) };
        data.put('exams_reviews', st, null);
      });
    }
  });
}

module.exports = { seedAll, AFFAIRS };
