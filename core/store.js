'use strict';
// Event-sourced store: append-only, hash-chained event log + projections into tables.
const crypto = require('crypto');

function nowIso() { return new Date().toISOString(); }
function newId(prefix = '') {
  // time-sortable, collision-safe across offline nodes
  const t = Date.now().toString(36).padStart(9, '0');
  return (prefix ? prefix + '_' : '') + t + crypto.randomBytes(6).toString('hex');
}
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

class Store {
  constructor(db, nodeId, tables) {
    this.db = db;
    this.node = nodeId;
    this.tables = tables; // { tableName: [cols...] } — grows as modules register
    this.listeners = [];   // (event) => void, called after commit
    this._lastHash = this._readLastHash();
    this._depth = 0;
  }

  // Re-entrant transactions: nested calls join the outer transaction.
  _begin() { if (this._depth++ === 0) this.db.exec('BEGIN'); }
  _commit() { if (--this._depth === 0) this.db.exec('COMMIT'); }
  _rollback() { if (this._depth > 0) { this._depth = 0; this.db.exec('ROLLBACK'); this._lastHash = this._readLastHash(); } }
  tx(fn) { this._begin(); try { const r = fn(); this._commit(); return r; } catch (e) { this._rollback(); throw e; } }

  registerTable(name, cols) { this.tables[name] = cols; }

  _readLastHash() {
    const r = this.db.prepare('SELECT hash FROM events WHERE node=? ORDER BY seq DESC LIMIT 1').get(this.node);
    return r ? r.hash : 'GENESIS';
  }

  // ---- event log ------------------------------------------------------
  append(type, payload, { actor = null, hamlet_id = null } = {}) {
    const ev = { id: newId('ev'), node: this.node, type, actor, hamlet_id, payload, ts: nowIso() };
    ev.prev_hash = this._lastHash;
    ev.hash = sha(ev.prev_hash + '|' + ev.id + '|' + type + '|' + JSON.stringify(payload) + '|' + ev.ts);
    this.db.prepare('INSERT INTO events (id,node,type,actor,hamlet_id,payload,ts,prev_hash,hash,local) VALUES (?,?,?,?,?,?,?,?,?,1)')
      .run(ev.id, ev.node, type, actor, hamlet_id, JSON.stringify(payload), ev.ts, ev.prev_hash, ev.hash);
    this._lastHash = ev.hash;
    return ev;
  }

  // Import an event produced on another node. Idempotent. Returns true if new.
  importEvent(ev) {
    const exists = this.db.prepare('SELECT 1 FROM events WHERE id=?').get(ev.id);
    if (exists) return false;
    const payload = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload;
    const expect = sha(ev.prev_hash + '|' + ev.id + '|' + ev.type + '|' + JSON.stringify(payload) + '|' + ev.ts);
    if (expect !== ev.hash) throw new Error('hash mismatch on event ' + ev.id);
    this.tx(() => {
      this.db.prepare('INSERT INTO events (id,node,type,actor,hamlet_id,payload,ts,prev_hash,hash,local) VALUES (?,?,?,?,?,?,?,?,?,0)')
        .run(ev.id, ev.node, ev.type, ev.actor, ev.hamlet_id, JSON.stringify(payload), ev.ts, ev.prev_hash, ev.hash);
      this._apply({ ...ev, payload });
    });
    this._notify({ ...ev, payload, imported: true });
    return true;
  }

  // ---- projections ------------------------------------------------------
  _apply(ev) {
    if (ev.type === 'row.upsert') return this._applyUpsert(ev.payload.table, ev.payload.row);
    if (ev.type === 'row.delete') return this._applyUpsert(ev.payload.table, { ...ev.payload.row, deleted: 1 });
  }

  _applyUpsert(table, row) {
    const cols = this.tables[table];
    if (!cols) return; // unknown table on this node (module not installed) — event still kept in log
    const cur = this.db.prepare(`SELECT updated_at, node FROM ${table} WHERE id=?`).get(row.id);
    // Last-writer-wins with deterministic tie-break → all nodes converge.
    if (cur && (cur.updated_at > row.updated_at || (cur.updated_at === row.updated_at && cur.node > row.node))) return;
    const all = ['id', 'updated_at', 'node', 'deleted', ...cols];
    const vals = all.map((c) => normalise(row[c] === undefined ? (c === 'deleted' ? 0 : null) : row[c]));
    this.db.prepare(`INSERT OR REPLACE INTO ${table} (${all.join(',')}) VALUES (${all.map(() => '?').join(',')})`).run(...vals);
  }

  // ---- public write API ------------------------------------------------------
  put(table, data, { actor = null } = {}) {
    const cols = this.tables[table];
    if (!cols) throw new Error('Unknown table ' + table);
    const existing = data.id ? this.get(table, data.id, { includeDeleted: true }) : null;
    const row = { ...(existing || {}) };
    for (const c of cols) if (data[c] !== undefined) row[c] = data[c];
    row.id = data.id || newId(table.slice(0, 3));
    row.updated_at = nowIso();
    if (existing && row.updated_at <= existing.updated_at) row.updated_at = bump(existing.updated_at);
    row.node = this.node;
    row.deleted = data.deleted ? 1 : 0;
    const hamlet_id = row.hamlet_id || (table === 'hamlets' ? row.id : null);
    const ev = this.tx(() => {
      const e = this.append('row.upsert', { table, row }, { actor, hamlet_id });
      this._applyUpsert(table, row);
      return e;
    });
    this._notify({ ...ev, payload: { table, row } });
    return this.get(table, row.id);
  }

  del(table, id, opts = {}) {
    const row = this.get(table, id);
    if (!row) return false;
    this.put(table, { ...row, deleted: 1 }, opts);
    return true;
  }

  // A domain event that is not a row change (e.g. "lesson.completed"). Logged + broadcast.
  emit(type, payload, opts = {}) {
    const ev = this.append(type, payload, opts);
    this._notify({ ...ev, payload });
    return ev;
  }

  get(table, id, { includeDeleted = false } = {}) {
    const r = this.db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    if (!r || (!includeDeleted && r.deleted)) return null;
    return parseRow(r);
  }

  find(table, where = {}, { order = null, limit = 5000 } = {}) {
    const keys = Object.keys(where);
    const cond = ['deleted=0', ...keys.map((k) => `${k}=?`)].join(' AND ');
    const sql = `SELECT * FROM ${table} WHERE ${cond}${order ? ' ORDER BY ' + order : ''} LIMIT ${Number(limit)}`;
    return this.db.prepare(sql).all(...keys.map((k) => normalise(where[k]))).map(parseRow);
  }

  all(sql, ...params) { return this.db.prepare(sql).all(...params).map(parseRow); }
  one(sql, ...params) { const r = this.db.prepare(sql).get(...params); return r ? parseRow(r) : null; }

  onEvent(fn) { this.listeners.push(fn); }
  _notify(ev) { for (const fn of this.listeners) { try { fn(ev); } catch (e) { console.error('[bus] listener error', e.message); } } }

  // Verify this node's hash chain end to end (tamper evidence).
  verifyChain(node = this.node) {
    let prev = 'GENESIS', n = 0;
    for (const ev of this.db.prepare('SELECT * FROM events WHERE node=? ORDER BY seq').iterate(node)) {
      const expect = sha(ev.prev_hash + '|' + ev.id + '|' + ev.type + '|' + ev.payload + '|' + ev.ts);
      if (ev.prev_hash !== prev || expect !== ev.hash) return { ok: false, brokenAt: ev.seq, checked: n };
      prev = ev.hash; n++;
    }
    return { ok: true, checked: n };
  }
}

function normalise(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}
function parseRow(r) {
  const o = { ...r };
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'string' && (v[0] === '[' || v[0] === '{')) { try { o[k] = JSON.parse(v); } catch (_) { /* keep string */ } }
  }
  return o;
}
function bump(iso) { return new Date(new Date(iso).getTime() + 1).toISOString(); }

module.exports = { Store, newId, nowIso, sha };
