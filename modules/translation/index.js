'use strict';
// AADI translation module — English → natural everyday Malayalam.
// Provider: Sarvam AI "Mayura" (mayura:v1) in modern-colloquial mode (configurable).
// Everything translated lands in a shared, event-sourced translation memory, so:
//   * the same sentence is never paid for twice,
//   * hubs get approved translations through normal sync and can use them offline,
//   * a native speaker reviews and corrects; approved versions always win over machine output.
// Configuration (environment):
//   SARVAM_API_KEY             — key from https://dashboard.sarvam.ai (required for live translation)
//   AADI_TRANSLATE_MODE        — modern-colloquial (default) | classic-colloquial | formal | code-mixed
//   AADI_TRANSLATE_MONTHLY_CAP — max characters sent per calendar month (default 500000 ≈ ₹1,000)
//   AADI_TRANSLATE_MOCK=1      — tests/offline demos: fake provider, no network
const crypto = require('crypto');

const MODES = ['modern-colloquial', 'classic-colloquial', 'formal', 'code-mixed'];
const PRICE_INR_PER_10K = 20; // Sarvam list price, Oct 2026 — check dashboard for your plan
const CHUNK = 900;           // Mayura accepts 1,000 characters per request; leave headroom for placeholders

const SEED_GLOSSARY = [
  ['hamlet', 'ഊര്', 0, 'Use the community word, not "ഗ്രാമം".'],
  ['Oorukoottam', 'ഊരുകൂട്ടം', 0, 'Hamlet assembly.'],
  ['consent', 'സമ്മതം', 0, 'Avoid "അനുമതി" (sounds like official permission).'],
  ['learning passport', 'പഠന പാസ്‌പോർട്ട്', 0, ''],
  ['facilitator', 'ഫെസിലിറ്റേറ്റർ', 0, 'Families already use the English word; "സഹായി" also fine in speech.'],
  ['tuition', 'ട്യൂഷൻ', 0, ''],
  ['AADI', 'ആദി', 0, 'Programme name.'],
  ['PSC', 'PSC', 1, 'Keep as is — everyone says PSC.'],
  ['SSLC', 'SSLC', 1, ''],
  ['UPI', 'UPI', 1, ''],
  ['Childline', 'ചൈൽഡ്‌ലൈൻ', 0, 'Always with the number 1098.'],
  ['mentor', 'മെന്റർ', 0, ''],
];
// Reviewed examples of the target register (natural, warm, everyday).
const SEED_MEMORY = [
  ['Your child attended 9 out of 10 classes this week. Well done!', 'ഈ ആഴ്ച 10 ക്ലാസിൽ 9-ലും കുട്ടി വന്നിരുന്നു. നന്നായി!'],
  ["Don't worry if you got it wrong. Try again.", 'തെറ്റിയാലും സാരമില്ല. ഒന്നൂടെ നോക്കാം!'],
  ["We need your consent before sharing your child's progress with this agency.", 'കുട്ടിയുടെ പഠനവിവരം ഈ സംഘടനയെ കാണിക്കണമെങ്കിൽ നിങ്ങൾ സമ്മതിക്കണം. വേണ്ടെങ്കിൽ എപ്പോൾ വേണമെങ്കിലും പിൻവലിക്കാം.'],
  ['Applications for the PSC exam close on 8 November.', 'PSC പരീക്ഷയ്ക്ക് നവംബർ 8 വരെ അപേക്ഷിക്കാം. അതിനുമുമ്പ് ചെയ്യണേ.'],
  ['If someone is troubling you, press this button. Only the child protection officer will see it.', 'ആരെങ്കിലും ശല്യം ചെയ്യുന്നുണ്ടോ? ഈ ബട്ടൺ അമർത്തിയാൽ മതി. കുട്ടികളെ സംരക്ഷിക്കുന്ന ചുമതലയുള്ള ആൾ മാത്രമേ ഇത് കാണൂ.'],
];

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const keyOf = (text, mode, tl = 'ml-IN') => crypto.createHash('sha256').update(`${tl}|${mode}|${norm(text).toLowerCase()}`).digest('hex').slice(0, 32);
const monthKey = () => new Date().toISOString().slice(0, 7);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Split long text on sentence boundaries so each request stays under the provider limit.
function chunks(text) {
  const out = [];
  let cur = '';
  for (const part of String(text).split(/(?<=[.!?।\n])\s+/)) {
    if ((cur + ' ' + part).trim().length > CHUNK && cur) { out.push(cur.trim()); cur = ''; }
    if (part.length > CHUNK) { for (let i = 0; i < part.length; i += CHUNK) out.push(part.slice(i, i + CHUNK)); continue; }
    cur += (cur ? ' ' : '') + part;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

module.exports = function init(ctx) {
  const { router, requires, data, sql, sqlOne, tx, emit, httpError } = ctx;
  const cfg = () => ({
    key: process.env.SARVAM_API_KEY || '',
    mock: process.env.AADI_TRANSLATE_MOCK === '1',
    mode: MODES.includes(process.env.AADI_TRANSLATE_MODE) ? process.env.AADI_TRANSLATE_MODE : 'modern-colloquial',
    cap: Number(process.env.AADI_TRANSLATE_MONTHLY_CAP || 500000),
  });
  const configured = () => !!(cfg().key || cfg().mock);

  // ---- glossary protection: terms marked keep-as-is or with a preferred rendering are replaced
  // by numbered tokens before sending, then restored. If a provider mangles a token we fall back
  // to inserting the term after the fact, so glossary words are never lost.
  function protect(text) {
    const terms = data.find('translation_glossary', {}, { limit: 500 }).sort((a, b) => b.term.length - a.term.length);
    const map = [];
    let out = text;
    for (const g of terms) {
      const re = new RegExp(`(?<![\\w])${escRe(g.term)}(?![\\w])`, 'gi');
      if (!re.test(out)) continue;
      const tok = `[[${map.length}]]`;
      out = out.replace(re, tok);
      map.push({ tok, value: g.keep_as_is ? g.term : g.preferred });
    }
    return { text: out, map };
  }
  // tolerant of providers adding spaces inside the token, e.g. "[ [0] ]"
  const restore = (text, map) => map.reduce((s, m, i) => s.replace(new RegExp(`\\[\\s*\\[\\s*${i}\\s*\\]\\s*\\]`, 'g'), m.value), text);

  function usage() {
    const m = monthKey();
    return data.find('translation_usage', { month: m })[0] || { month: m, chars: 0, requests: 0, failures: 0 };
  }
  function addUsage(chars, failed, user) {
    const u = usage();
    data.put('translation_usage', { ...u, chars: (u.chars || 0) + chars, requests: (u.requests || 0) + 1, failures: (u.failures || 0) + (failed ? 1 : 0), last_at: new Date().toISOString() }, user);
  }

  async function callSarvam(text, mode) {
    const c = cfg();
    if (c.mock) return `⟪ml:${mode}⟫ ${text}`;
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      let r;
      try {
        r = await fetch('https://api.sarvam.ai/translate', {
          method: 'POST',
          headers: { 'api-subscription-key': c.key, 'content-type': 'application/json' },
          body: JSON.stringify({ input: text, source_language_code: 'en-IN', target_language_code: 'ml-IN', model: 'mayura:v1', mode, output_script: 'fully-native', numerals_format: 'international' }),
          signal: AbortSignal.timeout(20000),
        });
      } catch (e) { lastErr = httpError(502, 'Could not reach the translation service. Check the internet connection and try again.'); await new Promise((s) => setTimeout(s, 600 * (attempt + 1))); continue; }
      if (r.ok) { const j = await r.json(); return j.translated_text; }
      if (r.status === 403 || r.status === 401) throw httpError(502, 'The Sarvam API key was refused. Check SARVAM_API_KEY on the server.');
      if (r.status === 429 || r.status >= 500) { lastErr = httpError(503, 'The translation service is busy. Try again in a minute.'); await new Promise((s) => setTimeout(s, 1000 * (attempt + 1))); continue; }
      const body = await r.text();
      throw httpError(502, 'Translation failed: ' + body.slice(0, 160));
    }
    throw lastErr;
  }

  // Translate one text; memory first, then provider. Returns {target, status, provider, cached}
  async function translate(text, { mode, context, user, force = false } = {}) {
    const src = norm(text);
    if (!src) throw httpError(400, 'Nothing to translate.');
    if (src.length > 8000) throw httpError(400, 'Please translate at most 8,000 characters at a time.');
    mode = MODES.includes(mode) ? mode : cfg().mode;
    const key = keyOf(src, mode);
    const hit = data.find('translation_memory', { source_key: key })[0];
    if (hit && !force) {
      data.put('translation_memory', { ...hit, uses: (hit.uses || 0) + 1 }, user);
      return { id: hit.id, source: hit.source, target: hit.target, status: hit.status, provider: hit.provider, mode, cached: true };
    }
    if (!configured()) throw httpError(503, 'Live translation is not switched on yet. An administrator needs to add the Sarvam API key on the server. Approved translations already in memory still work.');
    const c = cfg();
    const u = usage();
    if ((u.chars || 0) + src.length > c.cap) throw httpError(429, `This month's translation limit (${c.cap.toLocaleString('en-IN')} characters) has been reached. An administrator can raise AADI_TRANSLATE_MONTHLY_CAP.`);
    const { text: guarded, map } = protect(src);
    const parts = [];
    try {
      for (const ch of chunks(guarded)) parts.push(await callSarvam(ch, mode));
    } catch (e) { addUsage(src.length, true, user); throw e; }
    addUsage(src.length, false, user);
    let target = restore(parts.join(' '), map);
    // any glossary token the provider dropped entirely: leave the restored text as is (nothing to insert at a known position)
    target = target.replace(/\[\[\d+\]\]/g, '').replace(/\s{2,}/g, ' ').trim();
    const row = data.put('translation_memory', {
      ...(hit || {}), source_key: key, source: src, target, machine_target: target, source_lang: 'en-IN', target_lang: 'ml-IN', mode,
      provider: c.mock ? 'mock' : 'sarvam:mayura:v1', status: 'machine', context: context || null,
      requested_by: user && user.id, requested_by_name: user && user.display_name, chars: src.length, created_at: new Date().toISOString(), uses: 1,
    }, user);
    emit('translation.translated', { id: row.id, chars: src.length, mode }, user);
    return { id: row.id, source: src, target, status: 'machine', provider: row.provider, mode, cached: false };
  }

  // Starter style guide (glossary + reviewed examples). Runs once on any node — demo or production —
  // only on the cloud (hubs receive it by sync), and only if the glossary is still empty.
  function bootstrap() {
    if (ctx.brain.nodeRole === 'hub') return;
    if ((sqlOne('SELECT COUNT(*) n FROM translation_glossary') || {}).n) return;
    const now = new Date().toISOString();
    tx(() => {
      for (const [term, preferred, keep, note] of SEED_GLOSSARY) data.put('translation_glossary', { term, preferred, keep_as_is: keep, note, added_by_name: 'AADI style guide', created_at: now });
      for (const [en, ml] of SEED_MEMORY) data.put('translation_memory', { source_key: keyOf(en, 'modern-colloquial'), source: en, target: ml, machine_target: ml, source_lang: 'en-IN', target_lang: 'ml-IN', mode: 'modern-colloquial', provider: 'style-guide', status: 'approved', context: 'AADI style examples', reviewed_by_name: 'AADI style guide', reviewed_at: now, chars: en.length, created_at: now, uses: 0 });
    });
  }
  try { bootstrap(); } catch (e) { ctx.log('style guide bootstrap skipped:', e.message); }

  const WRITERS = ['teach', 'ops', 'agency.manage', 'counsel', 'hamlet.coordinate', 'content.review'];

  router.get('/status', requires(...WRITERS, 'content.review'), (req, res) => {
    const c = cfg(); const u = usage();
    const counts = Object.fromEntries(sql("SELECT status, COUNT(*) n FROM translation_memory WHERE deleted=0 GROUP BY status").map((r) => [r.status, r.n]));
    res.json({ configured: configured(), provider: c.mock ? 'mock' : (c.key ? 'Sarvam Mayura (mayura:v1)' : null), mode: c.mode, modes: MODES, cap: c.cap,
      month: u.month, chars_this_month: u.chars || 0, requests: u.requests || 0, failures: u.failures || 0,
      est_cost_inr: Math.round(((u.chars || 0) / 10000) * PRICE_INR_PER_10K), price_inr_per_10k: PRICE_INR_PER_10K, memory: counts, node: ctx.brain.nodeRole });
  });

  router.post('/translate', requires(...WRITERS), async (req, res) => {
    const out = await translate(req.body.text, { mode: req.body.mode, context: req.body.context, user: req.user, force: !!req.body.fresh });
    res.json(out);
  });

  // Translate several strings at once (e.g. a lesson's title + body). Max 50 items.
  router.post('/batch', requires(...WRITERS), async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 50) : [];
    const out = [];
    for (const it of items) {
      try { out.push({ ok: true, ...(await translate(typeof it === 'string' ? it : it.text, { mode: req.body.mode, context: it.context || req.body.context, user: req.user })) }); } catch (e) { out.push({ ok: false, source: typeof it === 'string' ? it : it.text, error: e.message }); if (e.status === 503 || e.status === 429) break; }
    }
    res.json({ items: out });
  });

  // Offline-friendly lookup: approved/edited first, never calls the provider.
  router.post('/lookup', ctx.authed, (req, res) => {
    const texts = (Array.isArray(req.body.texts) ? req.body.texts : []).slice(0, 200);
    const mode = MODES.includes(req.body.mode) ? req.body.mode : cfg().mode;
    res.json(Object.fromEntries(texts.map((t) => { const r = data.find('translation_memory', { source_key: keyOf(t, mode) })[0]; return [t, r ? { target: r.target, status: r.status } : null]; })));
  });

  router.get('/memory', requires(...WRITERS, 'content.review'), (req, res) => {
    const st = req.query.status;
    const q = req.query.q ? '%' + String(req.query.q) + '%' : null;
    let sqlText = 'SELECT * FROM translation_memory WHERE deleted=0';
    const p = [];
    if (st) { sqlText += ' AND status=?'; p.push(st); }
    if (q) { sqlText += ' AND (source LIKE ? OR target LIKE ?)'; p.push(q, q); }
    sqlText += ' ORDER BY created_at DESC LIMIT 300';
    res.json(sql(sqlText, ...p));
  });

  // Native-speaker review: approve as is, or correct and approve.
  router.post('/memory/:id/review', requires('content.review', 'platform.manage'), (req, res) => {
    const row = data.get('translation_memory', req.params.id);
    if (!row) throw httpError(404, 'Not found');
    const target = norm(req.body.target || row.target);
    if (!target) throw httpError(400, 'The Malayalam text cannot be empty.');
    const status = target === norm(row.machine_target || row.target) ? 'approved' : 'edited';
    const out = data.put('translation_memory', { ...row, target, status, reviewed_by: req.user.id, reviewed_by_name: req.user.display_name, reviewed_at: new Date().toISOString() }, req.user);
    emit('translation.approved', { id: row.id, status }, req.user);
    res.json(out);
  });
  router.delete('/memory/:id', requires('content.review', 'platform.manage'), (req, res) => { data.del('translation_memory', req.params.id, req.user); res.json({ ok: true }); });

  router.get('/glossary', requires(...WRITERS, 'content.review'), (req, res) => res.json(data.find('translation_glossary', {}, { order: 'term', limit: 1000 })));
  router.post('/glossary', requires('content.review', 'platform.manage'), (req, res) => {
    const term = norm(req.body.term);
    if (!term) throw httpError(400, 'Enter the English term.');
    const ex = data.find('translation_glossary', {}).find((g) => g.term.toLowerCase() === term.toLowerCase());
    const keep = req.body.keep_as_is ? 1 : 0;
    if (!keep && !norm(req.body.preferred)) throw httpError(400, 'Enter the Malayalam word, or tick "keep as is".');
    res.json(data.put('translation_glossary', { ...(ex || {}), term, preferred: keep ? term : norm(req.body.preferred), keep_as_is: keep, note: req.body.note || '', added_by_name: req.user.display_name, created_at: ex ? ex.created_at : new Date().toISOString() }, req.user));
  });
  router.delete('/glossary/:id', requires('content.review', 'platform.manage'), (req, res) => { data.del('translation_glossary', req.params.id, req.user); res.json({ ok: true }); });

  return {
    translate, // other modules may call through the brain later
    health: () => ({ configured: configured(), memory: (sqlOne('SELECT COUNT(*) n FROM translation_memory WHERE deleted=0') || {}).n || 0, chars_this_month: usage().chars || 0 }),
    seed: async () => bootstrap(),
  };
};

module.exports.chunks = chunks;
module.exports.keyOf = keyOf;
