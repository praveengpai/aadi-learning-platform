'use strict';
// AADI Brain — storage layer.
// Every replicated table has the standard columns: id, updated_at, node, deleted.
// All writes to replicated tables go through store.put / store.del, which first
// append an event to the hash-chained log and then apply it. State can therefore
// always be rebuilt from the log, and the log is what nodes (cloud <-> hubs) sync.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=OFF; PRAGMA busy_timeout=5000;');
  return db;
}

const STD_COLS = 'id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, node TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0';

// Replicated core tables. Column lists are explicit so the store can whitelist fields.
const CORE_TABLES = {
  hamlets: ['name', 'name_ml', 'district', 'panchayat', 'community', 'population', 'households', 'lat', 'lng', 'connectivity', 'power', 'hub_node', 'notes'],
  agencies: ['name', 'type', 'steward', 'contact', 'status', 'colour', 'about'],
  agency_presence: ['agency_id', 'hamlet_id', 'services', 'since', 'status'],
  centres: ['hamlet_id', 'agency_id', 'name', 'kind', 'hub_status', 'devices', 'last_sync'],
  programmes: ['agency_id', 'hamlet_id', 'centre_id', 'module', 'track', 'title', 'title_ml', 'schedule', 'capacity', 'status', 'sponsor_agency_id', 'brand', 'brand_ml'],
  persons: ['hamlet_id', 'name', 'gender', 'dob', 'kind', 'language', 'school_class', 'phone', 'guardian_id', 'relation', 'aspirations', 'literacy_level', 'notes', 'household_id'],
  // v2 — households: one family, many services
  households: ['hamlet_id', 'name', 'head_person_id', 'house_no', 'notes'],
  users: ['person_id', 'username', 'pass_hash', 'role', 'agency_id', 'centre_id', 'hamlet_ids', 'display_name', 'active', 'safeguarding_trained'],
  enrolments: ['person_id', 'programme_id', 'agency_id', 'hamlet_id', 'status', 'start_date'],
  consents: ['person_id', 'agency_id', 'scopes', 'granted_by', 'relation', 'status', 'granted_at', 'expires_at', 'method', 'hamlet_id'],
  competencies: ['code', 'domain', 'title', 'title_ml', 'level', 'stage'],
  passport_entries: ['person_id', 'hamlet_id', 'type', 'ref', 'title', 'level', 'evidence', 'issued_by_agency', 'issued_at'],
  notifications: ['person_id', 'hamlet_id', 'channel', 'message', 'status', 'module', 'created_at'],
  // v2 — form round-trip engine (capture offline at the hub → review in the city → reply returns next visit)
  form_defs: ['module', 'key', 'version', 'title', 'title_ml', 'description', 'scope', 'subject', 'fields', 'review', 'status', 'agency_id', 'source', 'capture_perm', 'allow_self'],
  form_submissions: ['form_id', 'form_key', 'module', 'person_id', 'household_id', 'hamlet_id', 'agency_id', 'answers', 'flags', 'priority', 'status',
    'captured_by', 'captured_at', 'client_ref', 'assigned_to', 'reply', 'reply_ml', 'replied_by', 'replied_at', 'reply_seen_at', 'outcome', 'closed_at'],
  // v2 — a module can be switched off in particular hamlets (the Oorukoottam decides)
  module_scopes: ['module_id', 'hamlet_id', 'enabled', 'decided_by', 'note'],
};

// Column types for v2 core tables that are not covered by colType's name rules.
const CORE_TYPES = { form_defs: { version: 'INTEGER', allow_self: 'INTEGER' }, form_submissions: { priority: 'INTEGER' }, module_scopes: { enabled: 'INTEGER' } };

function migrateCore(db) {
  for (const [t, cols] of Object.entries(CORE_TABLES)) {
    const ty = (c) => (CORE_TYPES[t] && CORE_TYPES[t][c]) || colType(c);
    db.exec(`CREATE TABLE IF NOT EXISTS ${t} (${STD_COLS}, ${cols.map((c) => `${c} ${ty(c)}`).join(', ')})`);
    // additive migration: new columns appear on existing databases without touching data
    const have = new Set(db.prepare(`PRAGMA table_info(${t})`).all().map((r) => r.name));
    for (const c of cols) if (!have.has(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${ty(c)}`);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT UNIQUE NOT NULL, node TEXT NOT NULL, type TEXT NOT NULL, actor TEXT,
      hamlet_id TEXT, payload TEXT NOT NULL, ts TEXT NOT NULL,
      prev_hash TEXT, hash TEXT NOT NULL, local INTEGER NOT NULL DEFAULT 1);
    CREATE INDEX IF NOT EXISTS ev_type ON events(type);
    CREATE INDEX IF NOT EXISTS ev_node ON events(node, seq);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT, expires_at TEXT);
    CREATE TABLE IF NOT EXISTS module_state (id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, version TEXT, schema_version INTEGER DEFAULT 0, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS sync_cursors (peer TEXT PRIMARY KEY, pulled_seq INTEGER DEFAULT 0, pushed_seq INTEGER DEFAULT 0, last_ok TEXT, last_error TEXT);
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
    CREATE INDEX IF NOT EXISTS persons_hamlet ON persons(hamlet_id);
    CREATE INDEX IF NOT EXISTS enr_person ON enrolments(person_id);
    CREATE INDEX IF NOT EXISTS cons_person ON consents(person_id, agency_id);
    CREATE INDEX IF NOT EXISTS pp_person ON passport_entries(person_id);
    CREATE INDEX IF NOT EXISTS fs_form ON form_submissions(form_key, status);
    CREATE INDEX IF NOT EXISTS fs_person ON form_submissions(person_id);
    CREATE INDEX IF NOT EXISTS fs_ref ON form_submissions(client_ref);
    CREATE INDEX IF NOT EXISTS hh_hamlet ON households(hamlet_id);
  `);
}

function colType(c) {
  if (/^(population|households|steward|capacity|active|safeguarding_trained|level|devices)$/.test(c)) return 'INTEGER';
  if (/^(lat|lng)$/.test(c)) return 'REAL';
  return 'TEXT';
}

module.exports = { openDb, migrateCore, CORE_TABLES, STD_COLS, colType };
