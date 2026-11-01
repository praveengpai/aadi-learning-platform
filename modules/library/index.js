'use strict';
// library module — open and government learning materials for learners, families and staff.
//
// The catalogue is built by a separate download tool that writes `${AADI_LIBRARY_DIR}/catalogue.json`
// next to the files it fetched. Offline items are streamed from that folder; online items link to
// the owner's own official page (we link rather than copy — copyright). Without a server folder the
// module falls back to content/catalogue-demo.json (all online).
//
// Tables (read directly by the `shelf` module — keep column names stable):
//   library_assignments, library_reads, library_curation
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PAGE = 50;
const RECHECK_MS = 60_000;
const STAFF_ROLES = ['platform_admin', 'cpo', 'agency_admin', 'coordinator', 'facilitator', 'teacher', 'counsellor', 'mentor'];
const NO_FILES = ['donor', 'employer', 'govt_viewer'];
const PERMISSION_NEEDED = ['COPYRIGHTED', 'MANUAL'];
const TRACK_SECTION = { exams: 'Exam preparation', language: 'Language and reading', lifeskills: 'Life skills and digital', digital: 'Life skills and digital', literacy: 'Literacy and equivalency' };
const MIME = {
  '.pdf': 'application/pdf', '.epub': 'application/epub+zip', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg',
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.zip': 'application/zip', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const COMMON_MEDIA = new Set(['', 'all', 'common', '-', 'multilingual']);

module.exports = function init(ctx) {
  const { router, requires, authed, data, sql, sqlOne, tx, emit, brain, httpError, log } = ctx;
  const DEMO_FILE = path.join(__dirname, 'content', 'catalogue-demo.json');

  // =================================================================== catalogue
  const cat = { source: 'none', dir: null, file: null, mtimeMs: 0, lastCheck: 0, meta: {}, items: [], byId: new Map(), error: null, loadedAt: null };
  let demoCache = null;

  const clsNumOf = (cls) => { const m = /^\s*(?:class|std\.?|standard)?\s*(\d{1,2})\s*$/i.exec(String(cls || '')); const n = m ? Number(m[1]) : null; return n >= 1 && n <= 12 ? n : null; };
  const isCommonMedium = (m) => COMMON_MEDIA.has(String(m || '').trim().toLowerCase());

  function normalise(raw) {
    const items = [];
    const seen = new Set();
    for (const r of Array.isArray(raw && raw.items) ? raw.items : []) {
      if (!r || typeof r !== 'object' || !r.title || !r.href) continue;
      const access = r.access === 'offline' ? 'offline' : 'online';
      if (access === 'online' && !/^https?:\/\//i.test(String(r.href))) continue; // never link to javascript: etc.
      let id = crypto.createHash('sha1').update(String(r.manifest_id || '') + '|' + String(r.href)).digest('hex').slice(0, 16);
      if (seen.has(id)) continue; // exact duplicate row
      seen.add(id);
      items.push({
        id, manifest_id: String(r.manifest_id || ''), section: r.section || 'Other', track: r.track || 'other', category: r.category || '',
        cls: String(r.cls ?? ''), cls_num: clsNumOf(r.cls), subject: String(r.subject || ''), medium: String(r.medium || ''), edition: r.edition || '',
        owner: r.owner || '', owner_id: r.owner_id || '', licence: r.licence || '', licence_detail: r.licence_detail || '',
        audience: r.audience === 'teacher' ? 'teacher' : 'learner', source_page: /^https?:\/\//i.test(String(r.source_page || '')) ? r.source_page : '',
        title: String(r.title), access, href: String(r.href), bytes: Number(r.bytes) || null, sha256: r.sha256 || null, note: r.note || '',
        _q: [r.title, r.subject, r.owner, r.category, r.medium, r.cls].join(' ').toLowerCase(),
      });
    }
    return items;
  }

  function useCatalogue(source, raw, extra = {}) {
    const items = normalise(raw);
    Object.assign(cat, { source, items, byId: new Map(items.map((i) => [i.id, i])), meta: { ...(raw.meta || {}) }, loadedAt: new Date().toISOString() }, extra);
  }

  function loadDemo(reason) {
    try {
      if (!demoCache) demoCache = JSON.parse(fs.readFileSync(DEMO_FILE, 'utf8'));
      useCatalogue('demo', demoCache, { file: DEMO_FILE, mtimeMs: 0 });
    } catch (e) {
      log('demo catalogue unreadable:', e.message);
      Object.assign(cat, { source: 'none', items: [], byId: new Map(), meta: {} });
    }
    if (reason) cat.error = reason;
  }

  // Check the server folder at most once a minute (immediately when the configured folder changes).
  function catalogue() {
    const dir = process.env.AADI_LIBRARY_DIR || null;
    const now = Date.now();
    if (cat.source !== 'none' && dir === cat.dir && now - cat.lastCheck < RECHECK_MS) return cat;
    const dirChanged = dir !== cat.dir;
    cat.lastCheck = now; cat.dir = dir;
    if (!dir) { if (cat.source !== 'demo' || dirChanged) { loadDemo(null); cat.error = null; } return cat; }
    const file = path.join(dir, 'catalogue.json');
    let st;
    try { st = fs.statSync(file); } catch (_) {
      if (cat.source !== 'demo' || dirChanged) loadDemo(`No catalogue.json in the library folder — showing the demo catalogue.`);
      return cat;
    }
    if (cat.source === 'server' && !dirChanged && st.mtimeMs === cat.mtimeMs) return cat;
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!raw || !Array.isArray(raw.items)) throw new Error('catalogue.json has no items[]');
      useCatalogue('server', raw, { file, mtimeMs: st.mtimeMs, error: null });
      log(`catalogue loaded from server folder: ${cat.items.length} items`);
    } catch (e) {
      log('catalogue.json unreadable:', e.message);
      cat.mtimeMs = st.mtimeMs; // don't re-parse the same broken file every minute
      if (cat.source !== 'server' || dirChanged) loadDemo('catalogue.json could not be read (' + e.message + ') — showing the demo catalogue.');
      else cat.error = 'catalogue.json could not be read (' + e.message + ') — still using the last good copy.';
    }
    return cat;
  }

  // =================================================================== curation + visibility
  function curationMap() {
    const m = new Map();
    for (const r of sql('SELECT item_id, status, note, by_name, at FROM library_curation WHERE deleted=0')) m.set(r.item_id, r);
    return m;
  }
  const isStaff = (u) => STAFF_ROLES.includes(u.role);
  const canCurate = (u) => brain.policy.can(u, 'content.review');
  const seesTeacher = (u) => isStaff(u);
  const seesHidden = (u) => canCurate(u) || u.role === 'platform_admin';

  function visible(u, item, cur) {
    if (!item) return false;
    if (item.audience === 'teacher' && !seesTeacher(u)) return false;
    const c = cur.get(item.id);
    if (c && c.status === 'hidden' && !seesHidden(u)) return false;
    return true;
  }

  function lite(item, cur, extra = {}) {
    const c = cur && cur.get(item.id);
    return {
      id: item.id, manifest_id: item.manifest_id, title: item.title, section: item.section, track: item.track, category: item.category,
      cls: item.cls, cls_num: item.cls_num, subject: item.subject, medium: item.medium, edition: item.edition, owner: item.owner,
      licence: item.licence, permission_needed: PERMISSION_NEEDED.includes(item.licence), audience: item.audience, access: item.access,
      open_url: item.access === 'offline' ? `/api/m/library/file/${item.id}` : item.href,
      source_page: item.source_page, bytes: item.bytes, note: item.note,
      featured: !!(c && c.status === 'featured'), hidden: !!(c && c.status === 'hidden'), ...extra,
    };
  }

  // =================================================================== learner helpers
  function preferredMedia(person, override) {
    if (override) return [override, 'Common'];
    const lang = String((person && person.language) || 'Malayalam').toLowerCase();
    if (lang.includes('english')) return ['English', 'Common', 'Malayalam'];
    if (lang.includes('tamil')) return ['Tamil', 'Common', 'English'];
    if (lang.includes('kannada')) return ['Kannada', 'Common', 'English'];
    return ['Malayalam', 'Common', 'English']; // Malayalam and tribal languages (Muthuvan, Irula, Paniya…)
  }
  function mediumRank(medium, prefs) {
    let best = 99;
    prefs.forEach((p, i) => {
      const ok = p === 'Common' ? isCommonMedium(medium) : String(medium).toLowerCase().includes(p.toLowerCase());
      if (ok && i < best) best = i;
    });
    return best;
  }
  function enrolledProgrammes(pid) {
    return brain.enrolments.forPerson(pid).filter((e) => ['active', 'completed'].includes(e.status)).map((e) => brain.programmes.get(e.programme_id)).filter(Boolean);
  }
  const inList = (arr) => arr.map(() => '?').join(',');

  function assignmentsForLearner(pid, progIds) {
    const params = [pid, ...progIds];
    return sql(`SELECT * FROM library_assignments WHERE deleted=0 AND (person_id=?${progIds.length ? ` OR programme_id IN (${inList(progIds)})` : ''}) ORDER BY COALESCE(due,'9999') ASC, created_at DESC`, ...params);
  }
  function readsFor(pid) {
    return new Map(data.find('library_reads', { person_id: pid }).map((r) => [r.item_id, r]));
  }
  const readLite = (r) => (r ? { opens: r.opens || 0, finished: !!r.finished, finished_at: r.finished_at, last_opened_at: r.last_opened_at, bookmark: r.bookmark || '', rating: r.rating || null } : null);

  function assignmentOut(a, C, cur, reads) {
    const item = C.byId.get(a.item_id);
    const pr = a.programme_id ? brain.programmes.get(a.programme_id) : null;
    return {
      id: a.id, item_id: a.item_id, title: a.title, section: a.section, programme_id: a.programme_id || null, programme: pr ? { id: pr.id, title: pr.title, title_ml: pr.title_ml, brand: pr.brand || null } : null,
      person_id: a.person_id || null, agency_id: a.agency_id, assigned_by_name: a.assigned_by_name, note: a.note || '', due: a.due || null, created_at: a.created_at,
      item: item ? lite(item, cur, reads ? { read: readLite(reads.get(item.id)) } : {}) : null, missing: !item,
    };
  }

  function myBooks(user, pid, mediumOverride) {
    const C = catalogue(); const cur = curationMap();
    const person = brain.persons.basic(pid);
    if (!person) throw httpError(404, 'Learner record not found');
    const prefs = preferredMedia(person, mediumOverride);
    const progs = enrolledProgrammes(pid);
    const reads = readsFor(pid);
    const ok = (i) => visible(user, i, cur) && i.audience === 'learner';

    const assigned = assignmentsForLearner(pid, progs.map((p) => p.id)).map((a) => assignmentOut(a, C, cur, reads)).filter((a) => !a.item || ok(C.byId.get(a.item_id)));

    // current-class books: one medium per subject (best available for this learner)
    const clsNum = clsNumOf(person.school_class);
    let textbooks = [];
    const classMedia = new Set();
    if (clsNum) {
      const pool = C.items.filter((i) => i.cls_num === clsNum && i.section === 'School (Class 1–12)' && ok(i));
      pool.forEach((i) => { if (i.medium) classMedia.add(i.medium); });
      const bySubject = new Map();
      for (const i of pool) {
        const r = mediumRank(i.medium, prefs);
        if (r >= 99) continue;
        const s = i.subject || '-';
        const best = bySubject.get(s);
        if (!best || r < best.rank) bySubject.set(s, { rank: r, items: [i] });
        else if (r === best.rank) best.items.push(i);
      }
      const catOrder = (c) => (c === 'School_Textbooks' ? 0 : /Activity/i.test(c) ? 1 : 2);
      textbooks = [...bySubject.values()].flatMap((b) => b.items)
        .sort((a, b) => catOrder(a.category) - catOrder(b.category) || a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title));
    }

    // track shelves for enrolled tracks
    const tracks = [...new Set(progs.map((p) => p.track).filter((t) => TRACK_SECTION[t]))];
    const trackShelves = [];
    const seenSections = new Set();
    for (const t of tracks) {
      const section = TRACK_SECTION[t];
      if (seenSections.has(section)) continue;
      seenSections.add(section);
      const pool = C.items.filter((i) => i.section === section && ok(i))
        .map((i) => ({ i, r: Math.min(mediumRank(i.medium, prefs), 98), f: cur.get(i.id)?.status === 'featured' ? 0 : 1, o: i.access === 'offline' ? 0 : 1 }))
        .sort((a, b) => a.f - b.f || a.o - b.o || a.r - b.r || a.i.title.localeCompare(b.i.title));
      trackShelves.push({ track: t, section, total: pool.length, items: pool.slice(0, 12).map((x) => lite(x.i, cur, { read: readLite(reads.get(x.i.id)) })) });
    }

    const reading = data.find('library_reads', { person_id: pid }, { order: 'last_opened_at DESC' });
    const cont = reading.filter((r) => !r.finished).slice(0, 8).map((r) => {
      const it = C.byId.get(r.item_id);
      return { ...readLite(r), item_id: r.item_id, title: r.title, section: r.section, item: it && ok(it) ? lite(it, cur) : null };
    }).filter((r) => r.item);

    return {
      person: { id: person.id, name: person.name, school_class: person.school_class, cls_num: clsNum, language: person.language, kind: person.kind },
      medium: { preferred: prefs, chosen: mediumOverride || null, available: [...classMedia].filter((m) => !isCommonMedium(m)).sort() },
      assigned, textbooks: textbooks.map((i) => lite(i, cur, { read: readLite(reads.get(i.id)) })), tracks: trackShelves, continue_reading: cont,
      counts: { assigned: assigned.length, assigned_open: assigned.filter((a) => !(a.item && a.item.read && a.item.read.finished)).length, textbooks: textbooks.length, reading: reading.filter((r) => !r.finished).length, finished: reading.filter((r) => r.finished).length, opened: reading.length },
      source: C.source,
    };
  }

  // =================================================================== browse
  function browse(user, q) {
    const C = catalogue(); const cur = curationMap();
    const text = String(q.q || '').trim().toLowerCase();
    const terms = text ? text.split(/\s+/).filter(Boolean) : [];
    let pool = C.items.filter((i) => visible(user, i, cur));
    if (q.audience && seesTeacher(user)) pool = pool.filter((i) => i.audience === q.audience);
    if (q.section) pool = pool.filter((i) => i.section === q.section);
    if (q.track) pool = pool.filter((i) => i.track === q.track);
    if (q.cls) pool = pool.filter((i) => String(i.cls_num) === String(q.cls) || i.cls === q.cls);
    if (q.subject) pool = pool.filter((i) => i.subject === q.subject);
    if (q.medium) pool = pool.filter((i) => (q.medium === 'Common' ? isCommonMedium(i.medium) : i.medium.toLowerCase().includes(String(q.medium).toLowerCase())));
    if (q.access === 'offline' || q.access === 'online') pool = pool.filter((i) => i.access === q.access);
    if (q.featured) pool = pool.filter((i) => cur.get(i.id)?.status === 'featured');
    if (q.hidden && seesHidden(user)) pool = pool.filter((i) => cur.get(i.id)?.status === 'hidden');
    if (terms.length) pool = pool.filter((i) => terms.every((t) => i._q.includes(t)));

    const count = (fn) => { const m = new Map(); for (const i of pool) { const k = fn(i); if (k === null || k === undefined || k === '') continue; m.set(k, (m.get(k) || 0) + 1); } return m; };
    const facets = {
      sections: [...count((i) => i.section)].map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n),
      classes: [...count((i) => i.cls_num)].map(([value, n]) => ({ value: String(value), n })).sort((a, b) => Number(a.value) - Number(b.value)),
      subjects: [...count((i) => i.subject)].map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n).slice(0, 60),
      media: [...count((i) => (isCommonMedium(i.medium) ? 'Common' : i.medium))].map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n).slice(0, 30),
      access: [...count((i) => i.access)].map(([value, n]) => ({ value, n })),
    };
    const sorted = pool.map((i) => ({ i, f: cur.get(i.id)?.status === 'featured' ? 0 : 1 }))
      .sort((a, b) => a.f - b.f || (a.i.cls_num || 99) - (b.i.cls_num || 99) || a.i.subject.localeCompare(b.i.subject) || a.i.title.localeCompare(b.i.title)).map((x) => x.i);
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const reads = user.role === 'learner' && user.person_id ? readsFor(user.person_id) : null;
    const items = sorted.slice((page - 1) * PAGE, page * PAGE).map((i) => lite(i, cur, reads ? { read: readLite(reads.get(i.id)) } : {}));
    return { total: pool.length, page, pages: Math.max(1, Math.ceil(pool.length / PAGE)), page_size: PAGE, items, facets, source: C.source };
  }

  function getItem(user, id) {
    const C = catalogue(); const cur = curationMap();
    const it = C.byId.get(String(id));
    if (!it || !visible(user, it, cur)) throw httpError(404, 'Item not found');
    return { it, cur, C };
  }

  // =================================================================== file serving
  function resolveFile(rootDir, href) {
    if (!rootDir) throw httpError(404, 'No library folder on this server');
    let rel;
    try { rel = String(href).split('/').map((s) => decodeURIComponent(s)).join('/'); } catch (_) { throw httpError(400, 'Bad file path'); }
    rel = rel.replace(/\\/g, '/');
    if (!rel || rel.includes('\0') || path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel) || rel.split('/').some((s) => s === '..')) throw httpError(403, 'File path refused');
    let rootReal;
    try { rootReal = fs.realpathSync(rootDir); } catch (_) { throw httpError(404, 'Library folder not available'); }
    const full = path.resolve(rootReal, rel);
    if (!full.startsWith(rootReal + path.sep)) throw httpError(403, 'File path refused');
    let real;
    try { real = fs.realpathSync(full); } catch (_) { throw httpError(404, 'File not on this server yet'); }
    if (!real.startsWith(rootReal + path.sep)) throw httpError(403, 'File path refused'); // symlink escaping the folder
    const st = fs.statSync(real);
    if (!st.isFile()) throw httpError(404, 'Not a file');
    return { real, st };
  }

  function sendFile(req, res, item) {
    const { real, st } = resolveFile(catalogue().dir, item.href);
    const ext = path.extname(real).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    res.setHeader('Content-Type', type);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', st.mtime.toUTCString());
    const fname = path.basename(real).replace(/[^\w.\- ]/g, '_');
    res.setHeader('Content-Disposition', `${MIME[ext] ? 'inline' : 'attachment'}; filename="${fname}"`);
    // Downloaded HTML/SVG must never run with this site's privileges.
    if (ext === '.html' || ext === '.htm' || ext === '.svg') res.setHeader('Content-Security-Policy', 'sandbox allow-scripts allow-popups allow-forms');
    if (req.headers['if-none-match'] === etag && !req.headers.range) { res.status(304).end(); return; }

    let start = 0; let end = st.size - 1; let status = 200;
    const range = req.headers.range;
    const ifRange = req.headers['if-range'];
    if (range && (!ifRange || ifRange === etag) && st.size > 0) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
      if (m && (m[1] !== '' || m[2] !== '')) {
        if (m[1] === '') { const n = Number(m[2]); start = Math.max(0, st.size - n); } else { start = Number(m[1]); if (m[2] !== '') end = Math.min(Number(m[2]), st.size - 1); }
        if (start > end || start >= st.size) { res.status(416).setHeader('Content-Range', `bytes */${st.size}`); res.end(); return; }
        status = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${st.size}`);
      }
      // multi-range or malformed: ignore and send the whole file (allowed by RFC 7233)
    }
    res.status(status);
    res.setHeader('Content-Length', st.size === 0 ? 0 : end - start + 1);
    if (req.method === 'HEAD' || st.size === 0) { res.end(); return; }
    const stream = fs.createReadStream(real, { start, end });
    stream.on('error', (e) => { log('file stream error:', e.message); res.destroy(e); });
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }

  // =================================================================== reads
  function recordOpen(user, item) {
    const pid = user.person_id;
    const p = brain.persons.basic(pid);
    const now = new Date().toISOString();
    const ex = data.find('library_reads', { person_id: pid, item_id: item.id })[0];
    const row = data.put('library_reads', ex
      ? { ...ex, opens: (ex.opens || 0) + 1, last_opened_at: now, title: item.title }
      : { person_id: pid, hamlet_id: p && p.hamlet_id, item_id: item.id, title: item.title, section: item.section, cls: item.cls, subject: item.subject, opened_at: now, last_opened_at: now, opens: 1, finished: 0, finished_at: null, bookmark: '', rating: null }, user);
    emit('library.opened', { person_id: pid, item_id: item.id, title: item.title, section: item.section, access: item.access, opens: row.opens }, user, p && p.hamlet_id);
    return row;
  }

  // =================================================================== staff helpers
  const agencyScope = (u) => (u.role === 'platform_admin' || u.role === 'cpo' ? null : u.agency_id || '__none__');

  function staffAssignments(user, q = {}) {
    const C = catalogue(); const cur = curationMap();
    const scope = agencyScope(user);
    const params = [];
    let s = 'SELECT * FROM library_assignments WHERE deleted=0';
    if (scope) { s += ' AND agency_id=?'; params.push(scope); }
    if (q.programme_id) { s += ' AND programme_id=?'; params.push(q.programme_id); }
    if (q.item_id) { s += ' AND item_id=?'; params.push(q.item_id); }
    s += ' ORDER BY created_at DESC LIMIT 300';
    const rows = sql(s, ...params);
    return rows.map((a) => {
      const out = assignmentOut(a, C, cur, null);
      let targets = [];
      if (a.person_id) {
        if (brain.policy.canSee(user, a.person_id, 'progress').ok) { const b = brain.persons.basic(a.person_id); out.person = b ? { id: b.id, name: b.name } : null; targets = [a.person_id]; } else { out.person = { id: null, name: '—' }; }
      } else if (a.programme_id) {
        targets = brain.enrolments.forProgramme(a.programme_id).filter((e) => e.status === 'active').map((e) => e.person_id).filter((pid) => brain.policy.canSee(user, pid, 'progress').ok);
      }
      if (targets.length) {
        const r = sqlOne(`SELECT COUNT(DISTINCT person_id) o, COUNT(DISTINCT CASE WHEN finished=1 THEN person_id END) f FROM library_reads WHERE deleted=0 AND item_id=? AND person_id IN (${inList(targets)})`, a.item_id, ...targets);
        out.progress = { learners: targets.length, opened: r.o, finished: r.f };
      } else out.progress = { learners: 0, opened: 0, finished: 0 };
      return out;
    });
  }

  function notifyAssigned(user, pids, item, due) {
    const msg = `${brain.brand.short}: New reading — "${item.title}"${due ? ` (by ${due})` : ''}. Open Library to read. / പുതിയ വായന: "${item.title}"${due ? ` — ${due} നകം` : ''}. വായനശാലയിൽ തുറക്കൂ.`;
    let n = 0;
    for (const pid of pids) { try { brain.notify(pid, msg, { channel: 'app' }, user); n++; } catch (_) { /* outbox best-effort */ } }
    return n;
  }

  // =================================================================== routes
  // ---- learner ----
  router.get('/me', requires('learn'), (req, res) => {
    if (!req.user.person_id) throw httpError(400, 'This account is not linked to a learner record');
    const m = req.query.medium ? String(req.query.medium).slice(0, 40) : null;
    res.json(myBooks(req.user, req.user.person_id, m));
  });

  // ---- browse / detail (any signed-in user; learners and families never see teacher items) ----
  router.get('/browse', authed, (req, res) => res.json(browse(req.user, req.query)));

  router.get('/items/:id', authed, (req, res) => {
    const { it, cur } = getItem(req.user, req.params.id);
    const out = lite(it, cur, { licence_detail: it.licence_detail, owner_id: it.owner_id, href: it.access === 'online' ? it.href : null, edition: it.edition });
    const cc = cur.get(it.id); if (cc && seesHidden(req.user)) out.curation = cc;
    if (req.user.role === 'learner' && req.user.person_id) {
      out.read = readLite(data.find('library_reads', { person_id: req.user.person_id, item_id: it.id })[0]);
      const progs = enrolledProgrammes(req.user.person_id).map((p) => p.id);
      out.assignments = assignmentsForLearner(req.user.person_id, progs).filter((a) => a.item_id === it.id).map((a) => ({ id: a.id, note: a.note, due: a.due, assigned_by_name: a.assigned_by_name }));
    } else if (isStaff(req.user)) {
      out.assignments = staffAssignments(req.user, { item_id: it.id }).map((a) => ({ id: a.id, programme: a.programme, person: a.person, due: a.due, note: a.note, progress: a.progress }));
    }
    res.json(out);
  });

  // ---- files ----
  router.get('/file/:id', authed, (req, res) => {
    if (NO_FILES.includes(req.user.role)) throw httpError(403, 'Files are available to learners, families and staff only');
    const C = catalogue(); const cur = curationMap();
    const it = C.byId.get(String(req.params.id));
    if (!it) throw httpError(404, 'Item not found');
    if (it.audience === 'teacher' && !seesTeacher(req.user)) throw httpError(403, 'This material is for teachers only');
    if (!visible(req.user, it, cur)) throw httpError(404, 'Item not found'); // hidden for the platform
    if (it.access !== 'offline') throw httpError(404, 'This item is online only — open the owner\'s page');
    sendFile(req, res, it);
  });

  // ---- reading log (learners, for themselves) ----
  router.post('/items/:id/open', requires('learn'), (req, res) => {
    if (!req.user.person_id) throw httpError(400, 'Not linked to a learner record');
    const { it } = getItem(req.user, req.params.id);
    res.json({ ok: true, read: readLite(recordOpen(req.user, it)) });
  });

  router.post('/items/:id/progress', requires('learn'), (req, res) => {
    const pid = req.user.person_id;
    if (!pid) throw httpError(400, 'Not linked to a learner record');
    const { it } = getItem(req.user, req.params.id);
    const b = req.body || {};
    let row = data.find('library_reads', { person_id: pid, item_id: it.id })[0] || recordOpen(req.user, it);
    const patch = {};
    if (b.bookmark !== undefined) patch.bookmark = String(b.bookmark ?? '').slice(0, 200);
    if (b.rating !== undefined && b.rating !== null) {
      const r = Number(b.rating);
      if (!Number.isInteger(r) || r < 1 || r > 3) throw httpError(400, 'rating must be 1, 2 or 3');
      patch.rating = r;
    }
    let newlyFinished = false;
    if (b.finished !== undefined) {
      const f = b.finished ? 1 : 0;
      if (f && !row.finished) { newlyFinished = true; patch.finished_at = new Date().toISOString(); }
      if (!f) patch.finished_at = null;
      patch.finished = f;
    }
    row = data.put('library_reads', { ...row, ...patch }, req.user);
    if (newlyFinished) emit('library.finished', { person_id: pid, item_id: it.id, title: it.title, section: it.section, rating: row.rating || null }, req.user, row.hamlet_id);
    res.json({ ok: true, read: readLite(row) });
  });

  // ---- assignments ----
  const ASSIGNERS = ['teach', 'hamlet.coordinate', 'agency.manage'];
  router.get('/programmes', requires(...ASSIGNERS), (req, res) => {
    const scope = agencyScope(req.user);
    const list = scope ? brain.programmes.list({ agency_id: scope }) : brain.programmes.list({});
    const hams = Array.isArray(req.user.hamlet_ids) && req.user.hamlet_ids.length ? new Set(req.user.hamlet_ids) : null;
    res.json(list.filter((p) => p.status !== 'closed' && (!hams || hams.has(p.hamlet_id))).map((p) => ({ id: p.id, title: p.title, title_ml: p.title_ml, track: p.track, hamlet_id: p.hamlet_id, hamlet: brain.hamlets.get(p.hamlet_id)?.name || '', brand: p.brand || null })));
  });

  router.get('/assignments', authed, (req, res) => {
    const u = req.user;
    if (u.role === 'learner') {
      if (!u.person_id) return res.json([]);
      const C = catalogue(); const cur = curationMap(); const reads = readsFor(u.person_id);
      const progs = enrolledProgrammes(u.person_id).map((p) => p.id);
      return res.json(assignmentsForLearner(u.person_id, progs).map((a) => assignmentOut(a, C, cur, reads)).filter((a) => !a.item || visible(u, C.byId.get(a.item_id), cur)));
    }
    if (!ASSIGNERS.some((p) => brain.policy.can(u, p))) throw httpError(403, 'Not available for your role');
    res.json(staffAssignments(u, req.query));
  });

  router.post('/assignments', requires(...ASSIGNERS), (req, res) => {
    const u = req.user; const b = req.body || {};
    const C = catalogue(); const cur = curationMap();
    const it = C.byId.get(String(b.item_id || ''));
    if (!it || !visible(u, it, cur)) throw httpError(404, 'Item not found');
    if (cur.get(it.id)?.status === 'hidden') throw httpError(400, 'This item is hidden for the platform and cannot be assigned');
    if (it.audience === 'teacher') throw httpError(400, 'Teacher materials cannot be assigned to learners');
    if (!!b.programme_id === !!b.person_id) throw httpError(400, 'Choose either a programme or a learner');
    const due = b.due ? String(b.due).slice(0, 10) : null;
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw httpError(400, 'due must be YYYY-MM-DD');
    const note = String(b.note || '').slice(0, 500);
    let row; let targets = [];
    if (b.programme_id) {
      const pr = brain.programmes.get(String(b.programme_id));
      if (!pr) throw httpError(404, 'Programme not found');
      if (u.role !== 'platform_admin' && pr.agency_id !== u.agency_id) throw httpError(403, 'You can only assign to your own agency\'s programmes');
      if (u.role !== 'platform_admin' && Array.isArray(u.hamlet_ids) && u.hamlet_ids.length && !u.hamlet_ids.includes(pr.hamlet_id)) throw httpError(403, 'This programme is outside your hamlets');
      row = { programme_id: pr.id, person_id: null, hamlet_id: pr.hamlet_id, agency_id: pr.agency_id };
      targets = brain.enrolments.forProgramme(pr.id).filter((e) => e.status === 'active').map((e) => e.person_id).filter((pid) => brain.policy.canSee(u, pid, 'profile').ok);
    } else {
      const pid = String(b.person_id);
      const v = brain.policy.canSee(u, pid, 'progress');
      if (!v.ok) throw httpError(403, 'Not permitted: ' + v.reason);
      const p = brain.persons.basic(pid);
      if (!p) throw httpError(404, 'Learner not found');
      row = { programme_id: null, person_id: pid, hamlet_id: p.hamlet_id, agency_id: u.agency_id || null };
      targets = [pid];
    }
    const a = data.put('library_assignments', { item_id: it.id, title: it.title, section: it.section, ...row, assigned_by: u.id, assigned_by_name: u.display_name || u.username, note, due, created_at: new Date().toISOString() }, u);
    const notified = notifyAssigned(u, targets, it, due);
    emit('library.assigned', { assignment_id: a.id, item_id: it.id, programme_id: a.programme_id, person_id: a.person_id, agency_id: a.agency_id, due }, u, a.hamlet_id);
    res.json({ ok: true, assignment: assignmentOut(a, C, cur, null), notified });
  });

  router.delete('/assignments/:id', requires(...ASSIGNERS), (req, res) => {
    const a = data.get('library_assignments', req.params.id);
    if (!a || a.deleted) throw httpError(404, 'Assignment not found');
    const u = req.user;
    if (u.role !== 'platform_admin' && a.agency_id !== u.agency_id && a.assigned_by !== u.id) throw httpError(403, 'Only your agency can withdraw this');
    data.del('library_assignments', a.id, u);
    brain.audit(u, 'assignment_withdrawn', a.id, { item_id: a.item_id });
    res.json({ ok: true });
  });

  // ---- curation + status ----
  router.get('/curation', requires('content.review', 'platform.manage'), (req, res) => {
    const C = catalogue();
    res.json(sql('SELECT * FROM library_curation WHERE deleted=0 ORDER BY at DESC').map((c) => ({ ...c, item: C.byId.has(c.item_id) ? lite(C.byId.get(c.item_id), null) : null })));
  });

  router.post('/curation', requires('content.review', 'platform.manage'), (req, res) => {
    const b = req.body || {};
    const C = catalogue();
    const it = C.byId.get(String(b.item_id || ''));
    if (!it) throw httpError(404, 'Item not found');
    if (!['hidden', 'featured', 'none'].includes(b.status)) throw httpError(400, 'status must be hidden, featured or none');
    const ex = data.find('library_curation', { item_id: it.id })[0];
    if (b.status === 'none') { if (ex) data.del('library_curation', ex.id, req.user); brain.audit(req.user, 'curation_cleared', it.id); return res.json({ ok: true, status: 'none' }); }
    const row = data.put('library_curation', { ...(ex || {}), item_id: it.id, status: b.status, note: String(b.note || '').slice(0, 300), by_name: req.user.display_name || req.user.username, at: new Date().toISOString() }, req.user);
    brain.audit(req.user, 'curation_' + b.status, it.id, { note: row.note });
    res.json({ ok: true, curation: row });
  });

  router.get('/status', requires('content.review', 'agency.manage', 'platform.manage'), (req, res) => {
    const C = catalogue(); const cur = curationMap();
    const bySection = {};
    for (const i of C.items) { const s = (bySection[i.section] = bySection[i.section] || { section: i.section, total: 0, offline: 0, online: 0, teacher: 0 }); s.total++; s[i.access]++; if (i.audience === 'teacher') s.teacher++; }
    const statuses = [...cur.values()];
    res.json({
      source: C.source, source_label: C.source === 'server' ? 'Server folder' : 'Demo catalogue (online links only)', folder_configured: !!C.dir,
      built: C.meta.built || null, loaded_at: C.loadedAt, checked_at: new Date(C.lastCheck).toISOString(), error: C.error,
      totals: { items: C.items.length, offline: C.items.filter((i) => i.access === 'offline').length, online: C.items.filter((i) => i.access === 'online').length, teacher: C.items.filter((i) => i.audience === 'teacher').length, offline_bytes: C.items.reduce((a, i) => a + (i.access === 'offline' ? i.bytes || 0 : 0), 0) },
      by_section: Object.values(bySection).sort((a, b) => b.total - a.total),
      hidden: statuses.filter((c) => c.status === 'hidden').length, featured: statuses.filter((c) => c.status === 'featured').length,
      permission_needed: C.items.filter((i) => PERMISSION_NEEDED.includes(i.licence)).length,
      by_licence: Object.entries(C.items.reduce((m, i) => ((m[i.licence || '—'] = (m[i.licence || '—'] || 0) + 1), m), {})).map(([licence, n]) => ({ licence, n })).sort((a, b) => b.n - a.n),
      reads_30d: sqlOne('SELECT COUNT(*) n FROM library_reads WHERE deleted=0 AND last_opened_at>=?', new Date(Date.now() - 30 * 86400e3).toISOString()).n,
      assignments: sqlOne('SELECT COUNT(*) n FROM library_assignments WHERE deleted=0').n,
    });
  });

  // ---- guardian ----
  router.get('/children', requires('family'), (req, res) => {
    const kids = brain.persons.visible(req.user, {}).filter((p) => p.id !== req.user.person_id);
    res.json(kids.map((p) => ({ id: p.id, name: p.name, kind: p.kind, school_class: p.school_class })));
  });

  router.get('/child/:pid', requires('family'), (req, res) => {
    const pid = req.params.pid;
    const v = brain.policy.canSee(req.user, pid, 'progress');
    if (!v.ok || pid === req.user.person_id) throw httpError(403, 'Not permitted: ' + (v.reason || 'not your ward'));
    const C = catalogue(); const cur = curationMap();
    const fake = { role: 'learner', person_id: pid }; // see what the child sees
    const reads = readsFor(pid);
    const progs = enrolledProgrammes(pid).map((p) => p.id);
    const assigned = assignmentsForLearner(pid, progs).map((a) => assignmentOut(a, C, cur, reads)).filter((a) => !a.item || visible(fake, C.byId.get(a.item_id), cur));
    const recent = data.find('library_reads', { person_id: pid }, { order: 'last_opened_at DESC', limit: 15 }).map((r) => ({ ...readLite(r), item_id: r.item_id, title: r.title, section: r.section, subject: r.subject, cls: r.cls, item: C.byId.has(r.item_id) && visible(fake, C.byId.get(r.item_id), cur) ? lite(C.byId.get(r.item_id), cur) : null }));
    const b = brain.persons.basic(pid);
    res.json({ child: { id: b.id, name: b.name, school_class: b.school_class, kind: b.kind }, assigned, recent, counts: { assigned: assigned.length, opened: reads.size, finished: [...reads.values()].filter((r) => r.finished).length } });
  });

  // =================================================================== seed
  function seed(demo) {
    const t0 = Date.now();
    const C = catalogue();
    const { R, daysAgo } = demo;
    const U = demo.users;
    const A = demo.agencyByKey; const H = demo.hamletByKey;
    const at = (n) => daysAgo(n);
    const dueIn = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
    const learnerItems = C.items.filter((i) => i.audience === 'learner');
    const classBooks = (n, prefs = ['Malayalam', 'Common']) => learnerItems.filter((i) => i.cls_num === n && i.section === 'School (Class 1–12)' && i.category === 'School_Textbooks' && mediumRank(i.medium, prefs) < 99);
    const pscPapers = learnerItems.filter((i) => i.section === 'Exam preparation' && /PSC/i.test(i.category + ' ' + i.title) && /question paper|answer key/i.test(i.title));
    const examAny = learnerItems.filter((i) => i.section === 'Exam preparation');
    const psc = pscPapers.length ? pscPapers : examAny;
    let n = 0;

    const put = (t, row, u) => { n++; return data.put(t, row, u || null); };
    const assign = (item, { programme, person, by, note, due, ago }) => {
      if (!item || !by) return;
      put('library_assignments', { item_id: item.id, title: item.title, section: item.section, programme_id: programme ? programme.id : null, person_id: person ? person.id : null, hamlet_id: (programme || person).hamlet_id, agency_id: programme ? programme.agency_id : by.agency_id, assigned_by: by.id, assigned_by_name: by.display_name, note, due, created_at: at(ago) }, by);
    };

    tx(() => {
      // --- CIF · Pachakkudi tuition (Class 5–10)
      const dl = demo.demoLearner; const dlCls = clsNumOf(dl && dl.school_class) || 8;
      const cifTuition = demo.programmesFor({ agency_id: A.cif.id, hamlet_id: H.h1.id, track: 'tuition' }).find((p) => /5–10/.test(p.title)) || demo.programmesFor({ agency_id: A.cif.id, hamlet_id: H.h1.id, track: 'tuition' })[0];
      const books = classBooks(dlCls);
      const fac = U.facilitator; const teacher = U.teacher;
      if (cifTuition) {
        assign(books.find((b) => /Mathematics|Ganitham/i.test(b.subject + b.title)) || books[0], { programme: cifTuition, by: fac, note: 'Read chapter 1 before Saturday\'s class. / ശനിയാഴ്ചത്തെ ക്ലാസിനു മുമ്പ് ഒന്നാം അധ്യായം വായിക്കുക.', due: dueIn(4), ago: 3 });
        assign(books.find((b) => /Basic Science|Adisthana/i.test(b.subject + b.title)) || books[1], { programme: cifTuition, by: teacher, note: 'Look at the pictures in the first lesson and bring one question. / ആദ്യ പാഠത്തിലെ ചിത്രങ്ങൾ നോക്കി ഒരു ചോദ്യം കൊണ്ടുവരിക.', due: dueIn(9), ago: 1 });
      }
      if (dl) assign(books.find((b) => /Malayalam|Kerala Padavali|Adisthana Padavali/i.test(b.subject + b.title)) || books[2], { person: dl, by: fac, note: 'Read one poem aloud to your family. / ഒരു കവിത വീട്ടുകാരെ വായിച്ചു കേൾപ്പിക്കുക.', due: dueIn(6), ago: 2 });

      // --- CIF · Thenmala PSC coaching
      const cifExams = demo.programmesFor({ agency_id: A.cif.id, hamlet_id: H.h2.id, track: 'exams' })[0];
      if (cifExams) {
        assign(psc[0], { programme: cifExams, by: U.facilitator2, note: 'Attempt this paper in 75 minutes, then check the key. / 75 മിനിറ്റിൽ എഴുതി, ഉത്തരസൂചിക നോക്കുക.', due: dueIn(5), ago: 6 });
        assign(psc[1], { programme: cifExams, by: U.facilitator2, note: 'Mark the questions you could not answer. / ഉത്തരം അറിയാത്തവ അടയാളപ്പെടുത്തുക.', due: dueIn(12), ago: 2 });
      }

      // --- AADI Smart Learning Centre · Komalikudi (youth group, CIF-sponsored)
      const kfac = U['aadi.facilitator'] || U['aadi.lead'];
      const kTuition = demo.programmesFor({ agency_id: A.kyg.id, hamlet_id: H.h11.id, track: 'tuition' });
      for (const pr of kTuition) {
        const band = /1–4/.test(pr.title) ? [3] : [7, 10];
        for (const c of band) { const bk = classBooks(c); assign(bk[0], { programme: pr, by: kfac, note: `Class ${c} textbook for this term. / ക്ലാസ് ${c} പാഠപുസ്തകം.`, due: dueIn(R.int(7, 20)), ago: R.int(2, 20) }); }
      }
      const kExams = demo.programmesFor({ agency_id: A.kyg.id, hamlet_id: H.h11.id, track: 'exams' })[0];
      if (kExams) assign(psc[2] || psc[0], { programme: kExams, by: kfac, note: 'Previous PSC paper — group practice on Sunday. / ഞായറാഴ്ച കൂട്ടായ പരിശീലനം.', due: dueIn(8), ago: 4 });

      // --- reading history
      const history = (person, pool, count, finishedShare) => {
        if (!person || !pool.length) return;
        const picks = R.sample(pool, Math.min(count, pool.length));
        picks.forEach((it, k) => {
          const first = R.int(10, 150); const last = Math.max(0, first - R.int(0, Math.min(first, 40)));
          const fin = k < Math.round(picks.length * finishedShare);
          put('library_reads', { person_id: person.id, hamlet_id: person.hamlet_id, item_id: it.id, title: it.title, section: it.section, cls: it.cls, subject: it.subject, opened_at: at(first), last_opened_at: at(last), opens: R.int(1, 9), finished: fin ? 1 : 0, finished_at: fin ? at(last) : null, bookmark: fin ? '' : R.pick(['p. 12', 'Chapter 2', 'p. 34', 'Lesson 3', '']), rating: fin ? R.int(2, 3) : null });
        });
      };
      const dlPool = learnerItems.filter((i) => i.section === 'School (Class 1–12)' && i.cls_num === dlCls && mediumRank(i.medium, ['Malayalam', 'Common']) < 99);
      history(dl, [...dlPool, ...learnerItems.filter((i) => i.section === 'Language and reading').slice(0, 10)], 10, 0.4);
      history(demo.demoYouth, [...psc.slice(0, 20), ...learnerItems.filter((i) => i.section === 'Life skills and digital').slice(0, 8)], 10, 0.5);

      // --- a few featured items so the star shows up
      const by = (U.steward && U.steward.display_name) || 'Platform Steward';
      for (const it of [books[0], psc[0], learnerItems.find((i) => i.section === 'Language and reading')].filter(Boolean)) put('library_curation', { item_id: it.id, status: 'featured', note: 'Good starting point', by_name: by, at: at(R.int(5, 30)) }, U.steward);
    });
    log(`seeded ${n} rows in ${Date.now() - t0}ms`);
  }

  function health() {
    const C = catalogue();
    return { source: C.source, items: C.items.length, offline: C.items.filter((i) => i.access === 'offline').length, error: C.error, reads: sqlOne('SELECT COUNT(*) n FROM library_reads WHERE deleted=0').n, assignments: sqlOne('SELECT COUNT(*) n FROM library_assignments WHERE deleted=0').n };
  }

  return { seed, health };
};
