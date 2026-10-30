'use strict';
// Consistent online backup of every node database in ./data (or AADI_DATA) using SQLite VACUUM INTO.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const dir = process.env.AADI_DATA || path.join(__dirname, '..', 'data');
const out = process.argv[2] || path.join(dir, 'backups');
fs.mkdirSync(out, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.db'))) {
  const target = path.join(out, `${f.replace(/\.db$/, '')}-${ts}.db`);
  const db = new DatabaseSync(path.join(dir, f));
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  db.close();
  console.log('backed up', f, '→', target);
}
