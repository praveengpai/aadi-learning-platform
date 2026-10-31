'use strict';
// Seeds the DEMO instance: 10 fictional tribal hamlets across Kerala, overlapping agencies,
// learners, guardians, staff, consents and enrolments — then asks every module to seed itself.
// All people and most organisations here are FICTIONAL demo data.
const fs = require('fs');
const path = require('path');

const DEMO_PASSWORD = 'demo1234';

function rngFactory(seed = 20261030) {
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;
  const sample = (arr, n) => { const c = [...arr]; const out = []; while (c.length && out.length < n) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return out; };
  return { rnd, int, pick, chance, sample };
}

const HAMLETS = [
  { key: 'h1', name: 'Pachakkudi', name_ml: 'പച്ചക്കുടി', district: 'Idukki', panchayat: 'Demo Panchayat A', community: 'Muthuvan', population: 420, households: 96, lat: 10.02, lng: 77.08, connectivity: '2g', power: 'solar' },
  { key: 'h2', name: 'Thenmala Ooru', name_ml: 'തേന്മല ഊര്', district: 'Palakkad (Attappadi)', panchayat: 'Demo Panchayat B', community: 'Irula', population: 610, households: 140, lat: 11.09, lng: 76.59, connectivity: '4g', power: 'grid' },
  { key: 'h3', name: 'Kurumbakolly', name_ml: 'കുറുമ്പക്കൊല്ലി', district: 'Wayanad', panchayat: 'Demo Panchayat C', community: 'Paniya', population: 380, households: 88, lat: 11.71, lng: 76.08, connectivity: '2g', power: 'grid' },
  { key: 'h4', name: 'Vellimala', name_ml: 'വെള്ളിമല', district: 'Wayanad', panchayat: 'Demo Panchayat D', community: 'Kurichiya', population: 290, households: 64, lat: 11.62, lng: 75.95, connectivity: '4g', power: 'grid' },
  { key: 'h5', name: 'Karimbara', name_ml: 'കരിമ്പാറ', district: 'Thiruvananthapuram', panchayat: 'Demo Panchayat E', community: 'Kani', population: 340, households: 77, lat: 8.68, lng: 77.16, connectivity: 'none', power: 'solar' },
  { key: 'h6', name: 'Neelakkunnu', name_ml: 'നീലക്കുന്ന്', district: 'Pathanamthitta', panchayat: 'Demo Panchayat F', community: 'Mala Pandaram', population: 160, households: 41, lat: 9.42, lng: 77.08, connectivity: 'none', power: 'none' },
  { key: 'h7', name: 'Mullakkadavu', name_ml: 'മുല്ലക്കടവ്', district: 'Malappuram (Nilambur)', panchayat: 'Demo Panchayat G', community: 'Cholanaikkan', population: 210, households: 52, lat: 11.32, lng: 76.42, connectivity: 'none', power: 'solar' },
  { key: 'h8', name: 'Kattuppara', name_ml: 'കാട്ടുപ്പാറ', district: 'Kannur', panchayat: 'Demo Panchayat H', community: 'Malavettuvan', population: 470, households: 110, lat: 12.11, lng: 75.62, connectivity: '4g', power: 'grid' },
  { key: 'h9', name: 'Ponmudikudi', name_ml: 'പൊന്മുടിക്കുടി', district: 'Idukki', panchayat: 'Demo Panchayat I', community: 'Mannan', population: 360, households: 83, lat: 9.86, lng: 77.03, connectivity: '2g', power: 'grid' },
  { key: 'h10', name: 'Arayanchal', name_ml: 'അരയാഞ്ചൽ', district: 'Kottayam', panchayat: 'Demo Panchayat J', community: 'Malayaraya', population: 520, households: 124, lat: 9.58, lng: 76.92, connectivity: '4g', power: 'grid' },
  { key: 'h11', name: 'Komalikudi', name_ml: 'കോമളിക്കുടി', district: 'Idukki', panchayat: 'Baisonvalley', community: 'Muthuvan', population: 300, households: 70, lat: 9.97, lng: 77.11, connectivity: '2g', power: 'grid', pilot: 1 },
];

const AGENCIES = [
  { key: 'cif', name: 'Community Innovations Foundation', type: 'ngo', steward: 1, colour: '#0f5a4e', about: 'Owner and steward of the platform (Section 8 company). Sponsors community-run programmes such as AADI.' },
  { key: 'vjt', name: 'Vanajyothi Trust (demo)', type: 'ngo', steward: 0, colour: '#b5651d', about: 'Fictional partner NGO — literacy and tuition in forest hamlets.' },
  { key: 'syf', name: 'Sahyadri Youth Forum (demo)', type: 'ngo', steward: 0, colour: '#6a4c93', about: 'Fictional youth organisation — PSC coaching and sports.' },
  { key: 'std', name: 'ST Development Office (demo)', type: 'govt', steward: 0, colour: '#1d4e89', about: 'Fictional government programme office — hostels, scholarships, literacy.' },
  { key: 'glc', name: 'GreenLeaf CSR Foundation (demo)', type: 'csr', steward: 0, colour: '#2e7d32', about: 'Fictional CSR funder — devices, digital literacy and placements.' },
  { key: 'sto', name: 'Sneha Outreach (demo)', type: 'faith', steward: 0, colour: '#c2185b', about: 'Fictional faith-based outreach — counselling and life skills.' },
  { key: 'kyg', name: 'Komalikudi Youth Group (led by Mr. Rajendran)', type: 'community', steward: 0, colour: '#a0522d', about: 'Local youth group that runs the AADI Smart Learning Centre at Komalikudi, Baisonvalley — sponsored by CIF.' },
  { key: 'uoc', name: 'University Outreach Cell (demo)', type: 'academic', steward: 0, colour: '#00838f', about: 'Fictional university partner — remote teachers, language lab, research.' },
];

// Which agencies serve which hamlets, with which tracks (deliberate overlaps + gaps)
const PRESENCE = {
  h1: { cif: ['tuition', 'exams', 'language', 'lifeskills', 'digital'], vjt: ['tuition', 'literacy'], sto: ['counselling'] },
  h2: { cif: ['tuition', 'exams', 'counselling'], syf: ['exams', 'lifeskills'], std: ['literacy'], uoc: ['language'] },
  h3: { vjt: ['tuition', 'literacy'], glc: ['digital', 'lifeskills'], cif: ['exams', 'counselling'] },
  h4: { syf: ['exams'], uoc: ['language', 'tuition'], std: ['literacy'] },
  h5: { cif: ['tuition', 'language', 'lifeskills', 'counselling'], std: ['literacy'] },
  h6: { vjt: ['literacy', 'tuition'], sto: ['counselling', 'lifeskills'] },
  h7: { cif: ['tuition', 'literacy', 'digital'], glc: ['digital'] },
  h8: { syf: ['exams', 'lifeskills'], glc: ['digital', 'lifeskills'], cif: ['language', 'counselling', 'exams'] },
  h9: { cif: ['tuition', 'exams', 'language'], vjt: ['tuition'], uoc: ['language'] },
  h10: { std: ['literacy', 'tuition'], sto: ['counselling'], syf: ['exams'], cif: ['lifeskills', 'digital'] },
  h11: { kyg: ['tuition', 'exams', 'counselling', 'digital', 'literacy'] },
};

const TRACK_MODULE = { tuition: 'learning', literacy: 'learning', exams: 'exams', language: 'language', lifeskills: 'lifeskills', digital: 'lifeskills', counselling: 'counselling' };
const TRACK_TITLES = {
  tuition: ['Tuition Class 1–4', 'ട്യൂഷൻ ക്ലാസ് 1–4', 'Tuition Class 5–10 (SSLC)', 'ട്യൂഷൻ 5–10 (SSLC)'],
  literacy: ['Adult Literacy Circle', 'സാക്ഷരതാ കൂട്ടം'],
  exams: ['PSC / Bank / SSC Coaching', 'PSC / ബാങ്ക് / SSC പരിശീലനം'],
  language: ['English Speaking Club', 'ഇംഗ്ലീഷ് സംസാര ക്ലബ്'],
  lifeskills: ['City Readiness & Grooming', 'നഗര ജീവിത പരിശീലനം'],
  digital: ['Digital & Money Skills', 'ഡിജിറ്റൽ, പണ സാക്ഷരത'],
  counselling: ['Career & Wellbeing Counselling', 'കരിയർ, ക്ഷേമ കൗൺസിലിംഗ്'],
};
const SLOTS = ['Mon 16:00', 'Tue 16:00', 'Wed 16:00', 'Thu 16:00', 'Fri 16:00', 'Sat 10:00', 'Sat 14:00', 'Sun 10:00'];

const M_FIRST = ['Anil', 'Biju', 'Suresh', 'Manu', 'Vishnu', 'Arun', 'Sanju', 'Rajeev', 'Babu', 'Kannan', 'Ajith', 'Shibu', 'Gokul', 'Akhil', 'Midhun', 'Rahul', 'Sabu', 'Unni', 'Vineeth', 'Jithin', 'Ramu', 'Chandran', 'Velayudhan', 'Kuttan', 'Mani', 'Ayyappan', 'Raju'];
const F_FIRST = ['Anitha', 'Bindu', 'Sreeja', 'Meera', 'Ammu', 'Arya', 'Sandhya', 'Remya', 'Lakshmi', 'Kavya', 'Neethu', 'Devika', 'Anjali', 'Sruthi', 'Athira', 'Reshma', 'Sindhu', 'Leela', 'Kalyani', 'Chinnamma', 'Parvathy', 'Malu', 'Gouri', 'Ponni', 'Valli', 'Thankamma'];
const SURN = ['K', 'M', 'R', 'S', 'P', 'V', 'T', 'C', 'A', 'N'];
const LANG = { Muthuvan: 'Muthuvan', Irula: 'Irula', Paniya: 'Paniya', Kurichiya: 'Malayalam', Kani: 'Kanikkar', 'Mala Pandaram': 'Malayalam', Cholanaikkan: 'Cholanaikkan', Malavettuvan: 'Malayalam', Mannan: 'Mannan', Malayaraya: 'Malayalam' };
const ASPIRE = ['Police (PSC)', 'Forest Guard (PSC)', 'Teacher', 'Nurse', 'Bank clerk', 'LDC (PSC)', 'Army', 'Driver', 'Hotel management', 'IT job', 'Tailoring business', 'Tourism guide', 'Engineer', 'Doctor', 'Sports'];

async function seed({ app, brain, host }) {
  // The pilot hamlet (Komalikudi) draws from its own random stream, so adding it leaves every
  // other demo hamlet's data exactly as before.
  const mainR = rngFactory(); const pilotR = rngFactory(7262);
  let curR = mainR;
  const R = { rnd: () => curR.rnd(), int: (a, b) => curR.int(a, b), pick: (x) => curR.pick(x), chance: (p) => curR.chance(p), sample: (x, n) => curR.sample(x, n) };
  const usePilot = (on) => { curR = on ? pilotR : mainR; };
  const { store } = brain;
  const daysAgo = (n) => new Date(Date.now() - n * 86400e3).toISOString();
  const dobForAge = (age) => { const d = new Date(Date.now() - (age * 365.25 + R.int(0, 300)) * 86400e3); return d.toISOString().slice(0, 10); };
  const name = (g) => `${R.pick(g === 'F' ? F_FIRST : M_FIRST)} ${R.pick(SURN)}`;

  const out = { hamlets: {}, agencies: {}, persons: [], children: [], youth: [], adults: [], users: {}, programmes: [], centres: [] };

  store.tx(() => {
    for (const a of AGENCIES) out.agencies[a.key] = store.put('agencies', { ...a, key: undefined, status: 'active', contact: a.key === 'cif' ? 'Kochi, Kerala' : 'demo@example.org' });
    for (const h of HAMLETS) out.hamlets[h.key] = store.put('hamlets', { ...h, key: undefined, pilot: undefined, hub_node: 'hub-' + h.name.toLowerCase().replace(/[^a-z]/g, ''), notes: h.pilot ? 'Pilot site of the AADI programme (CIF-sponsored, run by the local youth group). Learners shown in the demo are fictional.' : 'DEMO hamlet — fictional data' });

    // presence, centres, programmes
    for (const [hk, agMap] of Object.entries(PRESENCE)) {
      const h = out.hamlets[hk];
      usePilot(hk === 'h11');
      for (const [ak, tracks] of Object.entries(agMap)) {
        const a = out.agencies[ak];
        store.put('agency_presence', { agency_id: a.id, hamlet_id: h.id, services: tracks, since: daysAgo(R.int(60, 500)).slice(0, 10), status: 'active' });
        const c = store.put('centres', { hamlet_id: h.id, agency_id: a.id, name: ak === 'kyg' ? 'AADI Smart Learning Centre — Komalikudi' : `${ak === 'cif' ? 'CIF Learning Centre' : a.name.replace(' (demo)', '') + ' Centre'} — ${h.name}`, kind: (ak === 'cif' || ak === 'kyg') ? 'hub' : 'centre', hub_status: (ak === 'cif' || ak === 'kyg') ? (h.connectivity === 'none' ? 'courier' : 'online') : 'n/a', devices: R.int(2, 12), last_sync: daysAgo(h.connectivity === 'none' ? R.int(3, 9) : 0) });
        out.centres.push(c);
        for (const t of tracks) {
          const titles = TRACK_TITLES[t];
          const variants = t === 'tuition' ? [0, 2] : [0];
          for (const v of variants) {
            const slotCount = t === 'tuition' ? 3 : 2;
            out.programmes.push(store.put('programmes', { agency_id: a.id, hamlet_id: h.id, centre_id: c.id, module: TRACK_MODULE[t], track: t, title: titles[v], title_ml: titles[v + 1], ...(ak === 'kyg' ? { brand: 'AADI Smart Learning Centre', brand_ml: 'ആദി സ്മാർട്ട് ലേണിംഗ് സെന്റർ', sponsor_agency_id: out.agencies.cif.id } : {}), schedule: R.sample(SLOTS, slotCount), capacity: R.int(15, 40), status: 'active' }));
          }
        }
      }
    }

    // people: families with children, youth, adults
    for (const h of Object.values(out.hamlets)) {
      usePilot(h === out.hamlets.h11);
      const families = R.int(14, 20);
      for (let f = 0; f < families; f++) {
        const gG = R.chance(0.7) ? 'F' : 'M';
        const guardian = store.put('persons', { hamlet_id: h.id, name: name(gG), gender: gG, dob: dobForAge(R.int(30, 52)), kind: 'adult', language: LANG[h.community] || 'Malayalam', phone: '9' + String(R.int(100000000, 999999999)), literacy_level: R.pick(['none', 'basic', 'basic', 'functional', 'school']) });
        out.adults.push(guardian); out.persons.push(guardian);
        const kids = R.int(1, 3);
        for (let k = 0; k < kids; k++) {
          const age = R.int(6, 17); const g = R.chance(0.5) ? 'F' : 'M';
          const child = store.put('persons', { hamlet_id: h.id, name: name(g), gender: g, dob: dobForAge(age), kind: 'child', language: LANG[h.community] || 'Malayalam', school_class: String(Math.min(12, Math.max(1, age - 5 + R.int(-1, 0)))), guardian_id: guardian.id, relation: gG === 'F' ? 'mother' : 'father', aspirations: R.chance(0.6) ? R.pick(ASPIRE) : null, literacy_level: age < 9 ? 'emerging' : R.pick(['basic', 'functional', 'school']) });
          out.children.push(child); out.persons.push(child);
        }
        if (R.chance(0.6)) {
          const g = R.chance(0.5) ? 'F' : 'M';
          const youth = store.put('persons', { hamlet_id: h.id, name: name(g), gender: g, dob: dobForAge(R.int(18, 28)), kind: 'youth', language: LANG[h.community] || 'Malayalam', school_class: R.pick(['SSLC', 'Plus Two', 'Plus Two', 'Degree (discontinued)', 'Degree', 'Class 8 (dropped out)']), phone: R.chance(0.7) ? '9' + String(R.int(100000000, 999999999)) : null, guardian_id: guardian.id, relation: 'parent', aspirations: R.pick(ASPIRE), literacy_level: R.pick(['functional', 'school', 'school']) });
          out.youth.push(youth); out.persons.push(youth);
        }
      }
    }

    // competencies framework (modules may add more)
    const COMP = [
      ['LIT.ML.1', 'literacy', 'Reads Malayalam letters', 'മലയാളം അക്ഷരങ്ങൾ വായിക്കുന്നു', 1, 'primary'], ['LIT.ML.2', 'literacy', 'Reads simple Malayalam sentences', 'ലളിത വാക്യങ്ങൾ വായിക്കുന്നു', 2, 'primary'], ['LIT.ML.3', 'literacy', 'Writes a short paragraph', 'ചെറിയ ഖണ്ഡിക എഴുതുന്നു', 3, 'primary'],
      ['NUM.1', 'numeracy', 'Number sense to 100', '100 വരെ സംഖ്യാബോധം', 1, 'primary'], ['NUM.2', 'numeracy', 'Four operations', 'നാല് ക്രിയകൾ', 2, 'primary'], ['NUM.3', 'numeracy', 'Fractions & decimals', 'ഭിന്നസംഖ്യ, ദശാംശം', 3, 'upper'],
      ['ENG.1', 'english', 'Greets and introduces self in English', 'ഇംഗ്ലീഷിൽ സ്വയം പരിചയപ്പെടുത്തുന്നു', 1, 'all'], ['ENG.2', 'english', 'Holds a short conversation', 'ചെറിയ സംഭാഷണം', 2, 'all'], ['ENG.3', 'english', 'Interview-ready spoken English', 'ഇന്റർവ്യൂ ഇംഗ്ലീഷ്', 3, 'youth'],
      ['SCI.1', 'science', 'Basic science concepts (UP)', 'അടിസ്ഥാന ശാസ്ത്രം', 1, 'upper'], ['SSLC.MATH', 'numeracy', 'SSLC Mathematics readiness', 'SSLC ഗണിതം', 4, 'high'],
      ['PSC.GK', 'exams', 'Kerala PSC General Knowledge', 'PSC പൊതുവിജ്ഞാനം', 1, 'youth'], ['PSC.QA', 'exams', 'Quantitative aptitude', 'ഗണിത അഭിരുചി', 1, 'youth'], ['PSC.RS', 'exams', 'Reasoning', 'യുക്തിചിന്ത', 1, 'youth'], ['BANK.ENG', 'exams', 'Bank exam English', 'ബാങ്ക് ഇംഗ്ലീഷ്', 1, 'youth'],
      ['DIG.1', 'digital', 'Uses a smartphone safely', 'സ്മാർട്ട്ഫോൺ സുരക്ഷിതമായി', 1, 'all'], ['DIG.UPI', 'digital', 'Makes UPI payments safely', 'UPI ഇടപാടുകൾ', 2, 'youth'], ['DIG.GOV', 'digital', 'Uses government portals', 'സർക്കാർ പോർട്ടലുകൾ', 2, 'youth'],
      ['LS.WORK', 'lifeskills', 'Workplace etiquette', 'ജോലിസ്ഥല മര്യാദ', 1, 'youth'], ['LS.CITY', 'lifeskills', 'Navigates a city independently', 'നഗരത്തിൽ സ്വതന്ത്രമായി', 2, 'youth'], ['LS.INT', 'lifeskills', 'Interview skills', 'ഇന്റർവ്യൂ കഴിവുകൾ', 2, 'youth'], ['LS.SAFE', 'lifeskills', 'Online & personal safety', 'ഓൺലൈൻ, വ്യക്തി സുരക്ഷ', 1, 'all'],
    ];
    for (const [code, domain, title, title_ml, level, stage] of COMP) store.put('competencies', { id: 'cmp_' + code.toLowerCase().replace(/\./g, '_'), code, domain, title, title_ml, level, stage });
  });

  usePilot(false);
  // consents + enrolments (outside tx loop per hamlet for speed is fine)
  const progByHamlet = {};
  for (const p of out.programmes) (progByHamlet[p.hamlet_id] = progByHamlet[p.hamlet_id] || []).push(p);
  store.tx(() => {
    const pilotId = out.hamlets.h11 && out.hamlets.h11.id;
    const everyone = [...out.children, ...out.youth, ...out.adults];
    for (const p of [...everyone.filter((x) => x.hamlet_id !== pilotId), ...everyone.filter((x) => x.hamlet_id === pilotId)]) {
      usePilot(p.hamlet_id === pilotId);
      const progs = progByHamlet[p.hamlet_id] || [];
      const age = (Date.now() - new Date(p.dob)) / 3.15576e10;
      const fits = progs.filter((pr) => {
        if (p.kind === 'child') return pr.track === 'tuition' ? ((age < 10) === /1–4/.test(pr.title)) : ['language', 'lifeskills', 'counselling'].includes(pr.track) && age >= 12 && R.chance(0.35);
        if (p.kind === 'youth') return ['exams', 'language', 'lifeskills', 'digital', 'counselling'].includes(pr.track) && R.chance(0.65);
        return ['literacy', 'digital'].includes(pr.track) && p.literacy_level !== 'school' && R.chance(0.5);
      });
      const agenciesNeeded = [...new Set(fits.map((f) => f.agency_id))];
      for (const aid of agenciesNeeded) {
        if (R.chance(0.06)) continue; // some families decline consent for an agency — the platform must respect this
        const scopes = ['profile', 'progress'];
        if (R.chance(0.7)) scopes.push('contact');
        if (R.chance(0.5)) scopes.push('research');
        if (p.kind !== 'adult' && R.chance(0.45)) scopes.push('wellbeing');
        if (p.kind === 'youth' && R.chance(0.6)) scopes.push('employment');
        const minor = age < 18;
        const c = brain.grantConsent({ person_id: p.id, agency_id: aid, scopes, granted_by: minor ? p.guardian_id : p.id, relation: minor ? p.relation : 'self', method: R.pick(['in_person', 'in_person', 'ivr', 'app']) }, null);
        store.put('consents', { ...c, granted_at: daysAgo(R.int(20, 300)) });
        for (const pr of fits.filter((f) => f.agency_id === aid)) {
          const e = brain.enrol(p.id, pr.id, null);
          store.put('enrolments', { ...e, start_date: daysAgo(R.int(10, 280)).slice(0, 10), status: R.chance(0.08) ? 'dropped' : 'active' });
        }
      }
    }
  });

  // demo user accounts
  const A = out.agencies, H = out.hamlets;
  const mk = (key, role, display_name, extra = {}) => { out.users[key] = brain.createUser({ username: 'demo.' + key, password: DEMO_PASSWORD, role, display_name, safeguarding_trained: 1, ...extra }, null); return out.users[key]; };
  const pickPerson = (kind, hamlet, pred = () => true) => out.persons.find((p) => p.kind === kind && p.hamlet_id === hamlet.id && pred(p));
  // Choose demo learners who are enrolled with CIF in hamlet 1 / 2
  const enrolledWith = (pid, aid) => store.one('SELECT 1 x FROM enrolments WHERE person_id=? AND agency_id=? AND deleted=0', pid, aid);
  const childH1 = pickPerson('child', H.h1, (p) => enrolledWith(p.id, A.cif.id) && Number(p.school_class) >= 6 && Number(p.school_class) <= 9) || pickPerson('child', H.h1);
  let youthH2 = out.youth.find((p) => p.hamlet_id === H.h2.id && enrolledWith(p.id, A.cif.id)) || out.youth.find((p) => p.hamlet_id === H.h2.id);
  youthH2 = store.put('persons', { ...youthH2, aspirations: 'Police (PSC)' });
  out.youth[out.youth.findIndex((p) => p.id === youthH2.id)] = youthH2;
  out.persons[out.persons.findIndex((p) => p.id === youthH2.id)] = youthH2;
  const guardianOfChild = store.get('persons', childH1.guardian_id);

  store.tx(() => {
    mk('steward', 'platform_admin', 'Platform Steward (CIF)', { agency_id: A.cif.id });
    mk('cpo', 'cpo', 'Child Protection Officer', { agency_id: A.cif.id });
    mk('cif.admin', 'agency_admin', 'CIF Programme Admin', { agency_id: A.cif.id });
    mk('vjt.admin', 'agency_admin', 'Vanajyothi Admin', { agency_id: A.vjt.id });
    mk('syf.admin', 'agency_admin', 'Sahyadri Youth Admin', { agency_id: A.syf.id });
    mk('std.admin', 'agency_admin', 'ST Office Admin', { agency_id: A.std.id });
    mk('glc.admin', 'agency_admin', 'GreenLeaf Admin', { agency_id: A.glc.id });
    mk('sto.admin', 'agency_admin', 'Sneha Outreach Admin', { agency_id: A.sto.id });
    mk('uoc.admin', 'agency_admin', 'University Outreach Admin', { agency_id: A.uoc.id });
    mk('aadi.lead', 'agency_admin', 'AADI programme lead — Komalikudi Youth Group', { agency_id: A.kyg.id });
    mk('aadi.facilitator', 'facilitator', 'AADI facilitator — Komalikudi', { agency_id: A.kyg.id, hamlet_ids: [H.h11.id] });
    mk('coordinator', 'coordinator', 'Idukki Hamlet Coordinator (CIF)', { agency_id: A.cif.id, hamlet_ids: [H.h1.id, H.h9.id] });
    mk('facilitator', 'facilitator', 'Remya — Facilitator, Pachakkudi (CIF)', { agency_id: A.cif.id, centre_id: out.centres.find((c) => c.hamlet_id === H.h1.id && c.agency_id === A.cif.id).id, hamlet_ids: [H.h1.id] });
    mk('facilitator.vjt', 'facilitator', 'Biju — Facilitator, Pachakkudi (Vanajyothi)', { agency_id: A.vjt.id, hamlet_ids: [H.h1.id] });
    mk('facilitator2', 'facilitator', 'Suresh — Facilitator, Thenmala (CIF)', { agency_id: A.cif.id, hamlet_ids: [H.h2.id] });
    mk('teacher', 'teacher', 'Ms. Kavya — Remote Teacher (CIF)', { agency_id: A.cif.id });
    mk('teacher.uoc', 'teacher', 'Dr. Anand — Language Teacher (University)', { agency_id: A.uoc.id });
    mk('counsellor', 'counsellor', 'Sindhu — Counsellor (CIF)', { agency_id: A.cif.id });
    mk('mentor', 'mentor', 'Arjun — Volunteer Mentor (CIF)', { agency_id: A.cif.id });
    mk('learner', 'learner', childH1.name + ' — Learner (child)', { person_id: childH1.id });
    mk('youth', 'learner', youthH2.name + ' — Learner (PSC aspirant)', { person_id: youthH2.id });
    mk('guardian', 'guardian', guardianOfChild.name + ' — Guardian', { person_id: guardianOfChild.id });
    mk('donor', 'donor', 'GreenLeaf CSR — Donor view', { agency_id: A.glc.id });
    mk('employer', 'employer', 'Demo Hotels Pvt Ltd — Employer', { agency_id: A.glc.id });
    mk('govt', 'govt_viewer', 'District ST Office — Viewer', { agency_id: A.std.id });
  });

  usePilot(false);
  const demo = {
    brain, store, R, daysAgo, DEMO_PASSWORD,
    hamlets: Object.values(out.hamlets), hamletByKey: out.hamlets,
    agencies: Object.values(out.agencies), agencyByKey: out.agencies,
    persons: out.persons, children: out.children, youth: out.youth, adults: out.adults,
    users: out.users, programmes: out.programmes, centres: out.centres,
    programmesFor: (w) => out.programmes.filter((p) => Object.entries(w).every(([k, v]) => p[k] === v)),
    enrolledIn: (programmeId) => store.all('SELECT p.* FROM enrolments e JOIN persons p ON p.id=e.person_id WHERE e.programme_id=? AND e.deleted=0 AND e.status=\'active\'', programmeId),
    activeEnrolments: (where = {}) => store.find('enrolments', { status: 'active', ...where }),
    demoLearner: childH1, demoYouth: youthH2, demoGuardian: guardianOfChild,
  };
  await host.seedAll(demo);
  return demo;
}

module.exports = { seed, rngFactory, DEMO_PASSWORD, HAMLETS, AGENCIES };

if (require.main === module) {
  const { createApp } = require('../server');
  const node = process.env.AADI_NODE || 'cloud-1';
  const dbFile = process.env.AADI_DB || path.join(__dirname, '..', 'data', node + '.db');
  for (const f of [dbFile, dbFile + '-wal', dbFile + '-shm']) if (fs.existsSync(f)) fs.unlinkSync(f);
  const ctx = createApp({ dbFile, node });
  const t0 = Date.now();
  seed(ctx).then((d) => {
    const ev = ctx.brain.store.one('SELECT COUNT(*) n FROM events');
    console.log(`Seeded ${d.hamlets.length} hamlets, ${d.agencies.length} agencies, ${d.persons.length} people, ${d.programmes.length} programmes, ${ev.n} events in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`Demo accounts: demo.<role> / ${DEMO_PASSWORD}  (e.g. demo.steward, demo.facilitator, demo.learner, demo.youth, demo.guardian)`);
    process.exit(0);
  }).catch((e) => { console.error(e); process.exit(1); });
}
