'use strict';
// AADI Brain — sync between nodes (cloud <-> centre hubs, and courier/USB bundles).
// Events are immutable and globally unique, so sync is just "ship the events the
// other side doesn't have". Import is idempotent; projections converge by LWW.
const express = require('express');
const zlib = require('zlib');

module.exports = function makeSync(brain, { upstream = null, key = null, hamlets = [], intervalSec = 20 } = {}) {
  const r = express.Router();
  const { store, db } = brain;
  const state = { upstream, simulatedOffline: false, running: false, lastRun: null, lastError: null, backoff: intervalSec, timer: null, pushed: 0, pulled: 0 };

  const authKey = (req, res, next) => {
    if (key && req.headers['x-sync-key'] === key) return next();
    return brain.requires('platform.manage')(req, res, next);
  };
  const cursor = (peer) => db.prepare('SELECT * FROM sync_cursors WHERE peer=?').get(peer) || { peer, pulled_seq: 0, pushed_seq: 0 };
  const saveCursor = (c) => db.prepare('INSERT OR REPLACE INTO sync_cursors (peer,pulled_seq,pushed_seq,last_ok,last_error) VALUES (?,?,?,?,?)').run(c.peer, c.pulled_seq, c.pushed_seq, c.last_ok || null, c.last_error || null);

  function eventsAfter(seq, { excludeNode = null, hamletList = null, limit = 2000 } = {}) {
    let sql = 'SELECT seq,id,node,type,actor,hamlet_id,payload,ts,prev_hash,hash FROM events WHERE seq>?';
    const p = [seq];
    if (excludeNode) { sql += ' AND node<>?'; p.push(excludeNode); }
    if (hamletList && hamletList.length) { sql += ` AND (hamlet_id IS NULL OR hamlet_id IN (${hamletList.map(() => '?').join(',')}))`; p.push(...hamletList); }
    sql += ' ORDER BY seq LIMIT ' + limit;
    return db.prepare(sql).all(...p);
  }
  function importMany(events) {
    let added = 0, failed = 0;
    store.tx(() => {
      for (const ev of events) {
        if (ev.node === brain.nodeId) continue;
        try { if (store.importEvent(ev)) added++; } catch (e) { failed++; console.error('[sync] rejected event', ev.id, e.message); }
      }
    });
    return { added, failed };
  }

  // ---- server side (a node being synced against, usually the cloud) ----
  r.get('/pull', authKey, (req, res) => {
    const evs = eventsAfter(Number(req.query.after) || 0, { excludeNode: req.query.node, hamletList: req.query.hamlets ? String(req.query.hamlets).split(',') : null, limit: Math.min(Number(req.query.limit) || 2000, 5000) });
    res.json({ node: brain.nodeId, events: evs, last_seq: evs.length ? evs[evs.length - 1].seq : Number(req.query.after) || 0, more: evs.length >= (Number(req.query.limit) || 2000) });
  });
  r.post('/push', authKey, express.json({ limit: '50mb' }), (req, res) => {
    res.json(importMany(req.body.events || []));
  });

  // ---- courier mode: USB / SD card bundles for zero-connectivity centres ----
  r.get('/export', authKey, (req, res) => {
    const evs = eventsAfter(Number(req.query.after) || 0, { hamletList: req.query.hamlets ? String(req.query.hamlets).split(',') : null, limit: 1e7 });
    const buf = zlib.gzipSync(JSON.stringify({ format: 'aadi-bundle/1', from: brain.nodeId, created: new Date().toISOString(), events: evs }));
    brain.audit(req.user, 'sync.bundle_export', brain.nodeId, { events: evs.length });
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="aadi-${brain.nodeId}-${Date.now()}.aadi.gz"`);
    res.end(buf);
  });
  r.post('/import', authKey, express.raw({ type: () => true, limit: '200mb' }), (req, res) => {
    let data;
    try { data = JSON.parse(zlib.gunzipSync(req.body).toString('utf8')); } catch (e) { return res.status(400).json({ error: 'bad_bundle', message: 'Not a valid AADI bundle.' }); }
    if (data.format !== 'aadi-bundle/1') return res.status(400).json({ error: 'bad_bundle' });
    const out = importMany(data.events);
    brain.audit(req.user, 'sync.bundle_import', data.from, out);
    res.json({ from: data.from, ...out });
  });

  // ---- client side (a hub syncing to its upstream) ----
  async function runOnce() {
    if (!state.upstream) return { skipped: 'no upstream' };
    if (state.simulatedOffline) throw new Error('offline (simulated)');
    const c = cursor('upstream');
    const headers = { 'content-type': 'application/json', 'x-sync-key': key || '' };
    // push our own events
    const mine = db.prepare('SELECT seq,id,node,type,actor,hamlet_id,payload,ts,prev_hash,hash FROM events WHERE node=? AND seq>? ORDER BY seq LIMIT 2000').all(brain.nodeId, c.pushed_seq);
    if (mine.length) {
      const pr = await fetch(state.upstream + '/api/sync/push', { method: 'POST', headers, body: JSON.stringify({ events: mine }), signal: AbortSignal.timeout(30_000) });
      if (!pr.ok) throw new Error('push HTTP ' + pr.status);
      c.pushed_seq = mine[mine.length - 1].seq;
      state.pushed += mine.length;
    }
    // pull everything else
    let more = true, pulled = 0;
    while (more) {
      const url = `${state.upstream}/api/sync/pull?after=${c.pulled_seq}&node=${encodeURIComponent(brain.nodeId)}${hamlets.length ? '&hamlets=' + hamlets.join(',') : ''}`;
      const pl = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
      if (!pl.ok) throw new Error('pull HTTP ' + pl.status);
      const body = await pl.json();
      importMany(body.events);
      pulled += body.events.length;
      c.pulled_seq = body.last_seq;
      more = body.more;
    }
    state.pulled += pulled;
    c.last_ok = new Date().toISOString();
    c.last_error = null;
    saveCursor(c);
    return { pushed: mine.length, pulled };
  }

  async function loop() {
    if (state.running) return;
    state.running = true;
    try {
      const out = await runOnce();
      state.lastRun = { at: new Date().toISOString(), ...out };
      state.lastError = null;
      state.backoff = intervalSec;
    } catch (e) {
      state.lastError = e.message;
      const c = cursor('upstream'); c.last_error = e.message; saveCursor(c);
      state.backoff = Math.min(state.backoff * 2, 600); // exponential backoff, cap 10 min
    } finally {
      state.running = false;
      state.timer = setTimeout(loop, state.backoff * 1000);
      state.timer.unref();
    }
  }

  r.get('/status', brain.authed, (req, res) => res.json({
    node: brain.nodeId, role: brain.nodeRole, upstream: state.upstream, simulatedOffline: state.simulatedOffline,
    lastRun: state.lastRun, lastError: state.lastError, nextInSec: state.backoff, pushed: state.pushed, pulled: state.pulled,
    cursors: db.prepare('SELECT * FROM sync_cursors').all(),
    pending_to_push: state.upstream ? db.prepare('SELECT COUNT(*) n FROM events WHERE node=? AND seq>?').get(brain.nodeId, cursor('upstream').pushed_seq).n : 0,
    nodes: db.prepare('SELECT node, COUNT(*) events, MAX(ts) last FROM events GROUP BY node').all(),
  }));
  r.post('/now', brain.requires('platform.manage', 'ops'), async (req, res) => {
    try { res.json(await runOnce()); } catch (e) { res.status(502).json({ error: 'sync_failed', message: e.message }); }
  });
  r.post('/simulate-offline', brain.requires('platform.manage'), express.json(), (req, res) => {
    state.simulatedOffline = !!req.body.on;
    brain.audit(req.user, 'sync.simulate_offline', brain.nodeId, { on: state.simulatedOffline });
    res.json({ simulatedOffline: state.simulatedOffline });
  });

  function start() { if (state.upstream) { state.timer = setTimeout(loop, 2000); state.timer.unref(); } }
  return { router: r, start, runOnce, state, importMany, eventsAfter };
};
