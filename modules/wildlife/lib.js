'use strict';
// Human–Wildlife Conflict & Environment — pure helpers (no I/O): catalogue, the incident rule
// (sub-engine), plain-language sighting sentences, CSV import parsing and aggregate suppression.
// Everything here runs offline on a hub. Thresholds are drafts — see content/RULES.md.

const DAY = 86400e3;
const IST_MS = 5.5 * 3600e3; // Kerala is UTC+05:30 all year

// Days after an incident within which a claim should reach the range office. NOT a legal deadline:
// the real limit must be confirmed with the Forest Department (PENDING REVIEW). Configurable per deployment.
const CLAIM_WINDOW_DAYS = Math.max(1, Number(process.env.WILDLIFE_CLAIM_WINDOW_DAYS) || 14);
const CLAIM_WINDOW_STATUS = 'PENDING REVIEW — draft window, not a legal deadline';
// Early warning: this many elephant sightings within this many hours near one hamlet.
const ELEPHANT_ALERT = { count: 2, hours: 48 };
const MAX_IMPORT_ROWS = 500;
const MAX_IMPORT_CHARS = 200_000;
const K = 5;

const ch = (value, label, label_ml, extra = {}) => ({ value, label, label_ml, ...extra });

const ANIMALS = [
  ch('elephant', 'Elephant', 'ആന', { icon: '🐘', one: 'An elephant', many: 'Elephants', ml: 'ആന', ml_many: 'ആനകളെ', ml_one: 'ഒരു ആനയെ' }),
  ch('wild_boar', 'Wild boar', 'കാട്ടുപന്നി', { icon: '🐗', one: 'A wild boar', many: 'Wild boar', ml: 'കാട്ടുപന്നി', ml_many: 'കാട്ടുപന്നികളെ', ml_one: 'ഒരു കാട്ടുപന്നിയെ' }),
  ch('gaur', 'Gaur (Indian bison)', 'കാട്ടുപോത്ത്', { icon: '🐃', one: 'A gaur', many: 'Gaur', ml: 'കാട്ടുപോത്ത്', ml_many: 'കാട്ടുപോത്തുകളെ', ml_one: 'ഒരു കാട്ടുപോത്തിനെ' }),
  ch('monkey', 'Monkey', 'കുരങ്ങ്', { icon: '🐒', one: 'A monkey', many: 'Monkeys', ml: 'കുരങ്ങ്', ml_many: 'കുരങ്ങുകളെ', ml_one: 'ഒരു കുരങ്ങിനെ' }),
  ch('peacock', 'Peacock', 'മയിൽ', { icon: '🦚', one: 'A peacock', many: 'Peacocks', ml: 'മയിൽ', ml_many: 'മയിലുകളെ', ml_one: 'ഒരു മയിലിനെ' }),
  ch('porcupine', 'Porcupine', 'മുള്ളൻപന്നി', { icon: '🦔', one: 'A porcupine', many: 'Porcupines', ml: 'മുള്ളൻപന്നി', ml_many: 'മുള്ളൻപന്നികളെ', ml_one: 'ഒരു മുള്ളൻപന്നിയെ' }),
  ch('leopard_tiger', 'Leopard / tiger', 'പുലി / കടുവ', { icon: '🐆', one: 'A leopard or tiger', many: 'Leopards or tigers', ml: 'പുലി / കടുവ', ml_many: 'പുലികളെ / കടുവകളെ', ml_one: 'പുലിയെ / കടുവയെ' }),
  ch('snake', 'Snake', 'പാമ്പ്', { icon: '🐍', one: 'A snake', many: 'Snakes', ml: 'പാമ്പ്', ml_many: 'പാമ്പുകളെ', ml_one: 'ഒരു പാമ്പിനെ' }),
  ch('other', 'Other animal', 'മറ്റ് മൃഗം', { icon: '🐾', one: 'A wild animal', many: 'Wild animals', ml: 'മറ്റ് മൃഗം', ml_many: 'കാട്ടുമൃഗങ്ങളെ', ml_one: 'ഒരു കാട്ടുമൃഗത്തെ' }),
];
const ANIMAL = Object.fromEntries(ANIMALS.map((a) => [a.value, a]));

const DAMAGES = [
  ch('crops', 'Crops', 'കൃഷി', { icon: '🌾' }),
  ch('house', 'House', 'വീട്', { icon: '🏚️' }),
  ch('livestock', 'Livestock', 'വളർത്തുമൃഗങ്ങൾ', { icon: '🐄' }),
  ch('stored_grain', 'Stored grain / food', 'സൂക്ഷിച്ച ധാന്യം / ഭക്ഷണം', { icon: '🌽' }),
  ch('injury', 'Injury to a person', 'ആളിന് പരിക്ക്', { icon: '🩹' }),
  ch('death', 'Death of a person', 'ആളുടെ മരണം', { icon: '🕯️' }),
];
const DAMAGE = Object.fromEntries(DAMAGES.map((d) => [d.value, d]));

const TIMES = [
  ch('morning', 'Morning', 'രാവിലെ'), ch('afternoon', 'Afternoon', 'ഉച്ചയ്ക്ക്'),
  ch('evening', 'Evening', 'വൈകുന്നേരം'), ch('night', 'Night', 'രാത്രി'),
];
const TIME = Object.fromEntries(TIMES.map((t) => [t.value, t]));

const DIRECTIONS = [
  ch('towards_hamlet', 'Coming towards the hamlet', 'ഊരിന്റെ നേരെ വരുന്നു', { icon: '⬇️' }),
  ch('away_from_hamlet', 'Moving away from the hamlet', 'ഊരിൽ നിന്ന് അകന്നു പോകുന്നു', { icon: '⬆️' }),
  ch('along_stream', 'Along the stream / river', 'തോട് / പുഴ വഴി', { icon: '〰️' }),
  ch('along_road', 'Along the road / path', 'റോഡ് / വഴിയിലൂടെ', { icon: '🛤️' }),
  ch('into_forest', 'Back into the forest', 'കാട്ടിലേക്ക് തിരിച്ചു', { icon: '🌳' }),
  ch('staying', 'Staying in one place', 'ഒരിടത്ത് തന്നെ നിൽക്കുന്നു', { icon: '⏸️' }),
  ch('unknown', 'Not known', 'അറിയില്ല', { icon: '❔' }),
];
const DIRECTION = Object.fromEntries(DIRECTIONS.map((d) => [d.value, d]));

const READING_KINDS = {
  rainfall_mm: { unit: 'mm', min: 0, max: 1000, label: 'Rainfall', label_ml: 'മഴ', icon: '🌧️' },
  stream_level_cm: { unit: 'cm', min: 0, max: 2000, label: 'Stream level', label_ml: 'തോട്ടിലെ ജലനിരപ്പ്', icon: '🌊' },
  water_ph: { unit: 'pH', min: 0, max: 14, label: 'Water pH (strip)', label_ml: 'വെള്ളത്തിന്റെ pH (സ്ട്രിപ്പ്)', icon: '🧪' },
  water_turbidity: { unit: 'NTU', min: 0, max: 4000, label: 'Water cloudiness (turbidity)', label_ml: 'വെള്ളത്തിന്റെ കലക്കം', icon: '💧' },
  camera_trap_count: { unit: 'animals', min: 0, max: 1000, integer: true, label: 'Camera-trap count', label_ml: 'ക്യാമറ ട്രാപ്പ് എണ്ണം', icon: '📷' },
};

// Claim status: what the family hears, in plain words. Order = the usual path.
const CLAIM_STATUS = {
  prepared: { icon: '📝', label: 'Claim papers prepared', label_ml: 'നഷ്ടപരിഹാര അപേക്ഷ തയ്യാറാക്കി', plain: 'Your helper has prepared the claim papers with you.', plain_ml: 'സഹായി നിങ്ങളോടൊപ്പം നഷ്ടപരിഹാര അപേക്ഷ തയ്യാറാക്കി.' },
  submitted_to_range_office: { icon: '📨', label: 'Given to the Forest Range Office', label_ml: 'ഫോറസ്റ്റ് റേഞ്ച് ഓഫീസിൽ നൽകി', plain: 'The claim has been handed in at the Forest Range Office.', plain_ml: 'അപേക്ഷ ഫോറസ്റ്റ് റേഞ്ച് ഓഫീസിൽ നൽകി.' },
  inspection_done: { icon: '🔎', label: 'Forest officer inspected', label_ml: 'വനം ഉദ്യോഗസ്ഥൻ പരിശോധിച്ചു', plain: 'A forest officer has seen the damage.', plain_ml: 'ഒരു വനം ഉദ്യോഗസ്ഥൻ നാശനഷ്ടം നേരിട്ട് കണ്ടു.' },
  sanctioned: { icon: '✅', label: 'Compensation sanctioned', label_ml: 'നഷ്ടപരിഹാരം അനുവദിച്ചു', plain: 'Compensation has been sanctioned. The money comes next.', plain_ml: 'നഷ്ടപരിഹാരം അനുവദിച്ചു. പണം ഇനി വരും.' },
  paid: { icon: '💰', label: 'Money paid', label_ml: 'പണം നൽകി', plain: 'The money has been paid. Please check your bank account or passbook.', plain_ml: 'പണം നൽകി. ബാങ്ക് അക്കൗണ്ട് / പാസ്ബുക്ക് നോക്കുക.', final: true },
  rejected: { icon: '✖️', label: 'Not accepted', label_ml: 'അംഗീകരിച്ചില്ല', plain: 'The claim was not accepted this time. Your helper will explain why and help you appeal.', plain_ml: 'ഇത്തവണ അപേക്ഷ അംഗീകരിച്ചില്ല. കാരണം സഹായി വിശദീകരിക്കും, വീണ്ടും അപേക്ഷിക്കാൻ സഹായിക്കും.', final: true },
};
const NEXT = {
  prepared: ['submitted_to_range_office', 'rejected'],
  submitted_to_range_office: ['inspection_done', 'rejected'],
  inspection_done: ['sanctioned', 'rejected'],
  sanctioned: ['paid'],
  paid: [],
  rejected: ['submitted_to_range_office'], // re-submitted after an appeal or with missing papers
};
// The capturing agency's admin may record only what it does itself: hand the file in, and that the money arrived.
const CAPTURER_MAY = ['submitted_to_range_office', 'paid'];

// ---------------- time helpers (IST) ----------------
const istDate = (ms) => new Date(ms + IST_MS).toISOString().slice(0, 10);
const istHour = (ms) => new Date(ms + IST_MS).getUTCHours();
const timeOfDay = (ms) => { const h = istHour(ms); return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 16 ? 'afternoon' : h >= 16 && h < 20 ? 'evening' : 'night'; };
function relDay(ms, now = Date.now()) {
  const d = Math.round((Date.parse(istDate(now)) - Date.parse(istDate(ms))) / DAY);
  if (d <= 0) return { en: 'today', ml: 'ഇന്ന്' };
  if (d === 1) return { en: 'yesterday', ml: 'ഇന്നലെ' };
  return { en: `${d} days ago`, ml: `${d} ദിവസം മുമ്പ്` };
}

// ---------------- the incident rule (pure; never throws) ----------------
function assess(a, now = Date.now()) {
  const flags = [];
  let priority = 0;
  const dmg = Array.isArray(a.damage) ? a.damage : a.damage ? [a.damage] : [];
  const up = (p) => { priority = Math.max(priority, p); };
  if (dmg.includes('injury') || dmg.includes('death')) {
    flags.push({ code: 'person_hurt', level: 'urgent', message: 'Seek medical care / inform the forest office immediately — call 112 in an emergency.', message_ml: 'ഉടൻ ചികിത്സ തേടുക / വനം ഓഫീസിനെ ഉടൻ അറിയിക്കുക — അടിയന്തര സാഹചര്യത്തിൽ 112 വിളിക്കുക.' });
    up(3);
  }
  if (dmg.includes('house')) {
    flags.push({ code: 'house_damaged', level: 'warn', message: 'House damaged — ask the range office for an early inspection; keep the family safe tonight.', message_ml: 'വീടിന് നാശം — നേരത്തെ പരിശോധനയ്ക്ക് റേഞ്ച് ഓഫീസിനോട് ആവശ്യപ്പെടുക; ഇന്ന് രാത്രി കുടുംബം സുരക്ഷിതരായിരിക്കട്ടെ.' });
    up(2);
  }
  if (a.animal === 'leopard_tiger') {
    flags.push({ code: 'big_cat', level: 'warn', message: 'Leopard / tiger — inform the forest office today; keep children and animals inside after dark.', message_ml: 'പുലി / കടുവ — ഇന്നുതന്നെ വനം ഓഫീസിനെ അറിയിക്കുക; ഇരുട്ടിയാൽ കുട്ടികളെയും മൃഗങ്ങളെയും അകത്താക്കുക.' });
    up(2);
  }
  const t = a.incident_date ? Date.parse(a.incident_date) : NaN;
  if (Number.isFinite(t)) {
    const days = Math.floor((Date.parse(istDate(now)) - t) / DAY);
    if (days < 0) flags.push({ code: 'date_in_future', level: 'warn', message: 'The incident date is in the future — please check it.', message_ml: 'സംഭവ തീയതി ഭാവിയിലാണ് — ദയവായി പരിശോധിക്കുക.' });
    else if (days > CLAIM_WINDOW_DAYS) {
      flags.push({ code: 'claim_may_be_late', level: 'warn', days, message: `Incident was ${days} days ago — the claim may be late. Verify the deadline with the range office.`, message_ml: `സംഭവം ${days} ദിവസം മുമ്പാണ് — അപേക്ഷ വൈകിയിരിക്കാം. സമയപരിധി റേഞ്ച് ഓഫീസിൽ ഉറപ്പാക്കുക.` });
      up(1);
    }
  }
  if (!a.photo1 && !a.photo2) flags.push({ code: 'no_photo', level: 'info', message: 'No photo — photos of the damage help the claim a lot.', message_ml: 'ഫോട്ടോ ഇല്ല — നാശത്തിന്റെ ഫോട്ടോ അപേക്ഷയ്ക്ക് വളരെ സഹായകം.' });
  if (a.reported_forest === 'no') flags.push({ code: 'not_reported', level: 'info', message: 'Not yet told to the forest office — the claim file will be taken to the range office.', message_ml: 'വനം ഓഫീസിനെ ഇതുവരെ അറിയിച്ചിട്ടില്ല — അപേക്ഷ റേഞ്ച് ഓഫീസിലേക്ക് കൊണ്ടുപോകും.' });
  return { flags, priority };
}

// ---------------- sightings: a sentence to read aloud ----------------
const PREPS = /^(near|at|on|by|in|behind|beside|along|across|inside|outside|close to|next to)\b/i;
function sightingSentence(s, now = Date.now()) {
  const a = ANIMAL[s.animal] || ANIMAL.other;
  const ms = Date.parse(s.seen_at);
  const n = Number(s.count ?? s.group_size) || 1;
  const rd = relDay(ms, now);
  const tod = TIME[timeOfDay(ms)];
  const place = String(s.place || '').trim();
  const where = place ? (PREPS.test(place) ? ' ' + place : ' near ' + place) : '';
  const en = `${n > 1 ? a.many : a.one} seen${where} ${rd.en} ${tod.label.toLowerCase()}${n > 2 ? ` (about ${n})` : ''}.`;
  const placeMl = String(s.place_ml || place).trim();
  const ml = `${rd.ml} ${tod.label_ml}${placeMl ? ' ' + placeMl + ' ഭാഗത്ത്' : ''} ${n > 1 ? a.ml_many : a.ml_one} കണ്ടു${n > 2 ? ` (ഏകദേശം ${n})` : ''}.`;
  return { en, ml };
}

// ≥ ELEPHANT_ALERT.count elephant sightings within ELEPHANT_ALERT.hours → early-warning flag.
function elephantWarning(sightings, now = Date.now()) {
  const since = now - ELEPHANT_ALERT.hours * 3600e3;
  const recent = sightings.filter((s) => s.animal === 'elephant' && Date.parse(s.seen_at) >= since && Date.parse(s.seen_at) <= now + 3600e3);
  if (recent.length < ELEPHANT_ALERT.count) return null;
  const herd = recent.reduce((m, s) => Math.max(m, Number(s.count ?? s.group_size) || 1), 0);
  return {
    code: 'elephant_alert', level: 'warn', sightings: recent.length, largest_group: herd, hours: ELEPHANT_ALERT.hours,
    message: `Elephants seen ${recent.length} times near this hamlet in the last ${ELEPHANT_ALERT.hours} hours. Avoid forest paths after dark, keep children close, and tell the forest office. In danger call 112.`,
    message_ml: `കഴിഞ്ഞ ${ELEPHANT_ALERT.hours} മണിക്കൂറിൽ ഈ ഊരിനടുത്ത് ${recent.length} തവണ ആനകളെ കണ്ടു. ഇരുട്ടിയാൽ കാട്ടുവഴി ഒഴിവാക്കുക, കുട്ടികളെ അടുത്തു നിർത്തുക, വനം ഓഫീസിനെ അറിയിക്കുക. അപകടത്തിൽ 112 വിളിക്കുക.`,
  };
}

// ---------------- environment readings ----------------
// Parse a time written by a person or a logger. Times without a zone are Indian Standard Time.
function parseWhen(v) {
  const s = String(v || '').trim();
  let m;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/))) { // DD/MM/YYYY [HH:MM]
    const [, d, mo, y, hh = '0', mi = '0'] = m;
    if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return NaN;
    return Date.UTC(+y, +mo - 1, +d, +hh, +mi) - IST_MS;
  }
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/))) {
    const [, y, mo, d, hh = '0', mi = '0', ss = '0', , zone] = m;
    if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31 || +hh > 23 || +mi > 59) return NaN;
    if (zone) return Date.parse(s.replace(' ', 'T'));
    return Date.UTC(+y, +mo - 1, +d, +hh, +mi, +ss) - IST_MS;
  }
  return NaN;
}

function checkReading({ kind, value, at, animal }, now = Date.now()) {
  const K2 = READING_KINDS[kind];
  if (!K2) return { error: `unknown kind "${kind}" (use ${Object.keys(READING_KINDS).join(', ')})` };
  const v = typeof value === 'number' ? value : String(value ?? '').trim() === '' ? NaN : Number(value);
  if (!Number.isFinite(v)) return { error: 'value must be a number' };
  if (K2.integer && !Number.isInteger(v)) return { error: 'count must be a whole number' };
  if (v < K2.min || v > K2.max) return { error: `${K2.label} must be between ${K2.min} and ${K2.max} ${K2.unit}` };
  const t = typeof at === 'number' ? at : parseWhen(at);
  if (!Number.isFinite(t)) return { error: 'date/time not understood (use YYYY-MM-DD HH:MM or DD/MM/YYYY)' };
  if (t > now + 6 * 3600e3) return { error: 'date is in the future' };
  if (t < now - 730 * DAY) return { error: 'date is more than two years old' };
  let an = null;
  if (animal !== undefined && animal !== null && String(animal).trim() !== '') {
    an = String(animal).trim().toLowerCase().replace(/[\s/-]+/g, '_');
    if (an === 'tiger' || an === 'leopard') an = 'leopard_tiger';
    if (an === 'boar' || an === 'wildboar') an = 'wild_boar';
    if (!ANIMAL[an]) return { error: `unknown animal "${animal}"` };
    if (kind !== 'camera_trap_count') an = null;
  }
  return { row: { kind, value: v, unit: K2.unit, at: new Date(t).toISOString(), animal: an } };
}

// Split one CSV line (handles "quoted, fields" and "" escapes).
function splitCsv(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',' || c === ';' || c === '\t') { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

// Bulk paste from a rain-gauge or camera-trap log. Returns rows that passed and per-line errors;
// refuses outright (tooMany / tooBig) above the caps — the suitcase hub has little room.
function parseReadingsCsv(text, { kind = null, now = Date.now(), maxRows = MAX_IMPORT_ROWS } = {}) {
  const src = String(text || '');
  if (src.length > MAX_IMPORT_CHARS) return { tooBig: true, rows: [], errors: [{ line: 0, message: `Text is too long (max ${MAX_IMPORT_CHARS} characters) — split the log.` }] };
  const lines = src.split(/\r?\n/).map((l, i) => ({ n: i + 1, l: l.trim() })).filter((x) => x.l && !x.l.startsWith('#'));
  if (!lines.length) return { rows: [], errors: [{ line: 0, message: 'Nothing to import.' }], total: 0 };
  let cols = null;
  const first = splitCsv(lines[0].l).map((c) => c.toLowerCase());
  if (first.some((c) => /^(date|at|time|datetime|timestamp|kind|value|count|mm|rain|rainfall|level|device|source|animal|species)$/.test(c))) {
    cols = {};
    first.forEach((c, i) => {
      if (/^(date|at|time|datetime|timestamp)$/.test(c) && cols.at === undefined) cols.at = i;
      else if (c === 'kind') cols.kind = i;
      else if (/^(value|count|mm|rain|rainfall|level|reading)$/.test(c) && cols.value === undefined) cols.value = i;
      else if (/^(device|source|station|camera)$/.test(c) && cols.device === undefined) cols.device = i;
      else if (/^(animal|species)$/.test(c)) cols.animal = i;
    });
    lines.shift();
    if (cols.at === undefined || cols.value === undefined) return { rows: [], errors: [{ line: 1, message: 'Header needs a date column and a value column.' }], total: 0 };
    if (cols.kind === undefined && !kind) return { rows: [], errors: [{ line: 1, message: 'Say which kind of reading this is (choose it, or add a "kind" column).' }], total: 0 };
  } else {
    // No header: date,value[,device]  (kind chosen)  or  date,kind,value[,device]
    cols = kind ? { at: 0, value: 1, device: 2, animal: 3 } : { at: 0, kind: 1, value: 2, device: 3, animal: 4 };
  }
  if (lines.length > maxRows) return { tooMany: true, rows: [], errors: [{ line: 0, message: `Too many rows: ${lines.length} (max ${maxRows}). Split the log into smaller parts.` }], total: lines.length };
  const rows = []; const errors = [];
  for (const { n, l } of lines) {
    const f = splitCsv(l);
    const k2 = cols.kind !== undefined ? (f[cols.kind] || '').toLowerCase() : kind;
    const r = checkReading({ kind: k2, value: f[cols.value], at: f[cols.at], animal: cols.animal !== undefined ? f[cols.animal] : null }, now);
    if (r.error) { errors.push({ line: n, message: r.error }); continue; }
    const dev = cols.device !== undefined ? String(f[cols.device] || '').slice(0, 80) : '';
    rows.push({ ...r.row, device: dev || null, line: n });
  }
  return { rows, errors, total: lines.length };
}

// ---------------- aggregate suppression ----------------
// Cells 1–4 are shown as "<5". Any row / column / grand total that contains a hidden cell is
// itself "hidden", so a hidden cell can never be recovered by subtraction (complementary suppression).
const ks = (n, exempt) => (exempt ? n : n > 0 && n < K ? `<${K}` : n);
function suppressTable(table, { exempt = false, rowTotals = true } = {}) {
  const rows = {}; const colTot = {}; const colHidden = {}; let grand = 0; let any = false;
  for (const [rk, cells] of Object.entries(table)) {
    const out = {}; let tot = 0; let hid = false;
    for (const [c, n] of Object.entries(cells)) {
      tot += n; colTot[c] = (colTot[c] || 0) + n;
      out[c] = ks(n, exempt);
      if (typeof out[c] === 'string') { hid = true; colHidden[c] = true; any = true; }
    }
    grand += tot;
    rows[rk] = { cells: out, total: rowTotals ? (hid ? 'hidden' : ks(tot, exempt)) : undefined, hidden: hid };
  }
  const cols = Object.fromEntries(Object.entries(colTot).map(([c, n]) => [c, colHidden[c] ? 'hidden' : ks(n, exempt)]));
  return { rows, cols, total: any ? 'hidden' : ks(grand, exempt), any_hidden: any };
}

module.exports = {
  DAY, IST_MS, K, CLAIM_WINDOW_DAYS, CLAIM_WINDOW_STATUS, ELEPHANT_ALERT, MAX_IMPORT_ROWS, MAX_IMPORT_CHARS,
  ANIMALS, ANIMAL, DAMAGES, DAMAGE, TIMES, TIME, DIRECTIONS, DIRECTION, READING_KINDS, CLAIM_STATUS, NEXT, CAPTURER_MAY,
  istDate, istHour, timeOfDay, relDay, assess, sightingSentence, elephantWarning, parseWhen, checkReading, splitCsv, parseReadingsCsv, ks, suppressTable,
};
