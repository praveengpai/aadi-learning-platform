'use strict';
// AADI Brain — module host.
// Modules plug into the brain through a narrow, policy-checked SDK (ctx).
// Each module is isolated by a circuit breaker: if it keeps failing it is
// tripped and returns a friendly 503 while the rest of the platform runs on.
const fs = require('fs');
const path = require('path');
const express = require('express');

const BREAKER = { threshold: 5, windowMs: 60_000, coolOffMs: 30_000 };
// Modules allowed to read core personal tables directly (for aggregate-only work).
const PRIVILEGED = { 'core.read': ['analytics', 'operations', 'community', 'safeguarding', 'marketplace', 'learning', 'exams', 'language', 'lifeskills', 'counselling', 'channels'] };
const SAFE_CORE = ['hamlets', 'agencies', 'agency_presence', 'centres', 'programmes', 'competencies'];
const PERSONAL_CORE = ['persons', 'enrolments', 'consents', 'passport_entries', 'notifications', 'users'];

class ModuleHost {
  constructor(brain, dir) {
    this.brain = brain;
    this.dir = dir;
    this.modules = new Map(); // id -> { manifest, state, breaker, api, error }
    this.subs = [];           // { moduleId, type, fn }
    this.router = express.Router();
    brain.store.onEvent((ev) => this._dispatch(ev));
  }

  loadAll() {
    if (!fs.existsSync(this.dir)) return;
    const ids = fs.readdirSync(this.dir).filter((d) => fs.existsSync(path.join(this.dir, d, 'manifest.json'))).sort();
    for (const id of ids) this.load(id);
  }

  load(id) {
    const base = path.join(this.dir, id);
    const rec = { id, manifest: null, state: 'loading', error: null, breaker: { fails: [], openUntil: 0, trips: 0 }, api: {}, calls: 0, failures: 0 };
    this.modules.set(id, rec);
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'), 'utf8'));
      if (manifest.id !== id) throw new Error(`manifest id "${manifest.id}" must equal folder "${id}"`);
      rec.manifest = manifest;
      const prefix = id.replace(/-/g, '_') + '_';
      // Register module-owned replicated tables (must be prefixed with module id).
      const { db } = this.brain;
      const { STD_COLS, colType } = require('./db');
      for (const [t, cols] of Object.entries(manifest.tables || {})) {
        if (!t.startsWith(prefix)) throw new Error(`table "${t}" must start with "${prefix}"`);
        db.exec(`CREATE TABLE IF NOT EXISTS ${t} (${STD_COLS}, ${cols.map((c) => `${c} ${manifest.types?.[c] || colType(c)}`).join(', ')})`);
        // additive migration: add new columns in later versions without breaking old data
        const have = new Set(db.prepare(`PRAGMA table_info(${t})`).all().map((r) => r.name));
        for (const c of cols) if (!have.has(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${manifest.types?.[c] || colType(c)}`);
        this.brain.store.registerTable(t, cols);
      }
      const st = db.prepare('SELECT enabled FROM module_state WHERE id=?').get(id);
      if (!st) db.prepare('INSERT INTO module_state (id, enabled, version, updated_at) VALUES (?,?,?,?)').run(id, manifest.enabled === false ? 0 : 1, manifest.version, new Date().toISOString());
      const r = express.Router();
      const ctx = this._ctx(rec, r, prefix);
      const init = require(path.join(base, 'index.js'));
      rec.api = (typeof init === 'function' ? init(ctx) : init.init(ctx)) || {};
      rec.router = r;
      rec.state = this.isEnabled(id) ? 'up' : 'disabled';
      this.router.use('/' + id, (req, res, next) => this._gate(rec, req, res, next), r);
    } catch (e) {
      rec.state = 'failed';
      rec.error = e.message;
      // keep the URL space answering with a calm 503 instead of a confusing 404
      this.router.use('/' + id, (req, res, next) => this._gate(rec, req, res, next));
      console.error(`[modules] ${id} failed to load — platform continues without it:`, e.message);
    }
  }

  isEnabled(id) { const r = this.brain.db.prepare('SELECT enabled FROM module_state WHERE id=?').get(id); return !r || r.enabled === 1; }

  setEnabled(id, on, actor) {
    this.brain.db.prepare('UPDATE module_state SET enabled=?, updated_at=? WHERE id=?').run(on ? 1 : 0, new Date().toISOString(), id);
    const rec = this.modules.get(id);
    if (rec && rec.state !== 'failed') rec.state = on ? 'up' : 'disabled';
    this.brain.audit(actor, on ? 'module.enable' : 'module.disable', id);
  }

  _gate(rec, req, res, next) {
    if (rec.state === 'failed') return res.status(503).json({ error: 'module_unavailable', module: rec.id, message: 'This service is temporarily unavailable. Everything else keeps working.' });
    if (rec.state === 'disabled') return res.status(503).json({ error: 'module_disabled', module: rec.id, message: 'This service is switched off by the administrator.' });
    if (rec.breaker.openUntil > Date.now()) return res.status(503).json({ error: 'module_tripped', module: rec.id, retryAfterSec: Math.ceil((rec.breaker.openUntil - Date.now()) / 1000), message: 'This service had repeated errors and is resting. Other services are unaffected.' });
    rec.calls++;
    next();
  }

  _fail(rec, err, where) {
    rec.failures++;
    const now = Date.now();
    rec.breaker.fails = rec.breaker.fails.filter((t) => now - t < BREAKER.windowMs);
    rec.breaker.fails.push(now);
    rec.lastError = `${where}: ${err && err.message}`;
    if (rec.breaker.fails.length >= BREAKER.threshold) {
      rec.breaker.openUntil = now + BREAKER.coolOffMs;
      rec.breaker.trips++;
      rec.breaker.fails = [];
      console.error(`[breaker] ${rec.id} tripped for ${BREAKER.coolOffMs / 1000}s`);
      try { this.brain.store.emit('platform.module_tripped', { module: rec.id, error: rec.lastError }); } catch (_) { /* never cascade */ }
    }
  }

  _wrap(rec, handler) {
    return async (req, res, next) => {
      try {
        await Promise.race([
          Promise.resolve(handler(req, res, next)),
          new Promise((_, rej) => setTimeout(() => rej(new Error('handler timeout')), 15_000).unref()),
        ]);
      } catch (e) {
        // Only genuine faults (5xx) count toward the breaker; a 4xx is the module doing its job.
        if (!e.status || e.status >= 500) this._fail(rec, e, `${req.method} ${req.path}`);
        if (!res.headersSent) {
          const code = e.status || 500;
          res.status(code).json({ error: code === 500 ? 'module_error' : (e.code || 'error'), message: code === 500 ? 'Something went wrong in this service.' : e.message });
        }
        if (!e.status) console.error(`[${rec.id}]`, e.stack || e.message);
      }
    };
  }

  _dispatch(ev) {
    for (const s of this.subs) {
      if (s.type !== '*' && s.type !== ev.type && !(s.type.endsWith('*') && ev.type.startsWith(s.type.slice(0, -1)))) continue;
      const rec = this.modules.get(s.moduleId);
      if (!rec || rec.state !== 'up' || rec.breaker.openUntil > Date.now()) continue;
      setImmediate(() => {
        try { const r = s.fn(ev); if (r && r.catch) r.catch((e) => this._fail(rec, e, 'event ' + ev.type)); } catch (e) { this._fail(rec, e, 'event ' + ev.type); }
      });
    }
  }

  _ctx(rec, router, prefix) {
    const brain = this.brain;
    const host = this;
    const own = (t) => t.startsWith(prefix);
    const privileged = (PRIVILEGED['core.read'] || []).includes(rec.id);
    const wrapRouter = {};
    for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
      wrapRouter[m] = (p, ...hs) => router[m](p, ...hs.map((h, i) => (i === hs.length - 1 ? host._wrap(rec, h) : h)));
    }
    const checkSql = (sql) => {
      if (!/^\s*(SELECT|WITH)\b/i.test(sql)) throw new Error('ctx.sql is read-only (SELECT/WITH)');
      const ids = [...sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*)/gi)].map((m) => m[1].toLowerCase());
      for (const t of ids) {
        if (own(t) || SAFE_CORE.includes(t)) continue;
        if (PERSONAL_CORE.includes(t) && privileged) continue;
        if (brain.store.tables[t] && !PERSONAL_CORE.includes(t) && !SAFE_CORE.includes(t)) continue; // other modules' tables: read-only allowed
        throw new Error(`module "${rec.id}" may not read table "${t}" directly — use ctx.brain APIs`);
      }
    };
    return {
      id: rec.id,
      manifest: rec.manifest,
      router: wrapRouter,
      requires: (...perms) => brain.requires(...perms),
      authed: brain.authed,
      // module-owned replicated data (event-sourced, synced to hubs)
      data: {
        put: (t, row, user) => { if (!own(t)) throw new Error('not your table: ' + t); return brain.store.put(t, row, { actor: user && user.id }); },
        del: (t, id, user) => { if (!own(t)) throw new Error('not your table: ' + t); return brain.store.del(t, id, { actor: user && user.id }); },
        get: (t, id) => { checkSql('SELECT 1 FROM ' + t); return brain.store.get(t, id); },
        find: (t, where, opts) => { checkSql('SELECT 1 FROM ' + t); return brain.store.find(t, where, opts); },
      },
      sql: (sql, ...params) => { checkSql(sql); return brain.store.all(sql, ...params); },
      sqlOne: (sql, ...params) => { checkSql(sql); return brain.store.one(sql, ...params); },
      tx: (fn) => brain.store.tx(fn),
      emit: (type, payload, user, hamlet_id) => {
        if (!type.startsWith(rec.id + '.')) throw new Error(`events from ${rec.id} must be named "${rec.id}.*"`);
        return brain.store.emit(type, payload, { actor: user && user.id, hamlet_id });
      },
      on: (type, fn) => host.subs.push({ moduleId: rec.id, type, fn }),
      brain: brain.facade(rec.id),
      log: (...a) => console.log(`[${rec.id}]`, ...a),
      httpError: (status, message) => Object.assign(new Error(message), { status }),
    };
  }

  status() {
    return [...this.modules.values()].map((m) => ({
      id: m.id,
      name: m.manifest?.name, name_ml: m.manifest?.name_ml, icon: m.manifest?.icon, description: m.manifest?.description,
      version: m.manifest?.version, nav: m.manifest?.nav || [], has_ui: fs.existsSync(path.join(this.dir, m.id, 'public', 'ui.js')),
      state: m.breaker.openUntil > Date.now() ? 'tripped' : m.state,
      error: m.error || null, lastError: m.lastError || null, calls: m.calls, failures: m.failures, trips: m.breaker.trips,
      critical: !!m.manifest?.critical,
    }));
  }

  // Health snapshot per module (module may expose api.health()).
  health() {
    return this.status().map((s) => {
      const rec = this.modules.get(s.id);
      let extra = null;
      try { extra = rec.api && rec.api.health ? rec.api.health() : null; } catch (e) { extra = { error: e.message }; }
      return { ...s, extra };
    });
  }

  async seedAll(demo) {
    for (const rec of this.modules.values()) {
      if (rec.state !== 'up' || !rec.api || !rec.api.seed) continue;
      const t0 = Date.now();
      try { await rec.api.seed(demo); console.log(`[seed] ${rec.id} ok (${Date.now() - t0}ms)`); } catch (e) { console.error(`[seed] ${rec.id} FAILED:`, e.stack || e.message); }
    }
  }
}

module.exports = { ModuleHost, BREAKER };
