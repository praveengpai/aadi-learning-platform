'use strict';
// Sign every module folder with the platform key, so nodes started with PLATFORM_MODULE_KEY
// refuse modules that were changed after signing.  Usage:
//   PLATFORM_MODULE_KEY=... node scripts/sign-modules.js [moduleId ...]
const fs = require('fs');
const path = require('path');
const { signModule } = require('../core/modules');

const key = process.env.PLATFORM_MODULE_KEY;
if (!key) { console.error('Set PLATFORM_MODULE_KEY first.'); process.exit(1); }
const dir = path.join(__dirname, '..', 'modules');
const only = process.argv.slice(2);
for (const id of fs.readdirSync(dir).sort()) {
  const base = path.join(dir, id);
  if (!fs.existsSync(path.join(base, 'manifest.json')) || (only.length && !only.includes(id))) continue;
  fs.writeFileSync(path.join(base, 'SIGNATURE'), signModule(base, key) + '\n');
  console.log('signed', id);
}
