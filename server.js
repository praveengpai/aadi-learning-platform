'use strict';
// Learning platform (CIF) — entry point. The same code runs as the cloud core or as a centre hub.
//   AADI_NODE=cloud-1  AADI_ROLE=cloud  node server.js
//   AADI_NODE=hub-komalikudi AADI_ROLE=hub AADI_UPSTREAM=https://cloud AADI_SYNC_KEY=... node server.js
const path = require('path');
const express = require('express');
const { Brain } = require('./core/brain');
const { ModuleHost } = require('./core/modules');
const coreApi = require('./core/api');
const makeSync = require('./core/sync');

function createApp(opts = {}) {
  const cfg = {
    port: Number(process.env.PORT || opts.port || 8080),
    node: process.env.AADI_NODE || opts.node || 'cloud-1',
    role: process.env.AADI_ROLE || opts.role || 'cloud',
    dbFile: opts.dbFile || process.env.AADI_DB || path.join(__dirname, 'data', `${process.env.AADI_NODE || opts.node || 'cloud-1'}.db`),
    upstream: process.env.AADI_UPSTREAM || opts.upstream || null,
    syncKey: process.env.AADI_SYNC_KEY || opts.syncKey || null,
    hamlets: (process.env.AADI_HUB_HAMLETS || opts.hamlets || '').split(',').filter(Boolean),
    modulesDir: opts.modulesDir || path.join(__dirname, 'modules'),
  };
  const brain = new Brain({ dbFile: cfg.dbFile, nodeId: cfg.node, role: cfg.role });
  const host = new ModuleHost(brain, cfg.modulesDir);
  host.loadAll();
  const sync = makeSync(brain, { upstream: cfg.upstream, key: cfg.syncKey, hamlets: cfg.hamlets });

  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-AADI-Node', cfg.node);
    next();
  });
  app.use('/api/sync', sync.router);
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/core', coreApi(brain, host));
  app.use('/api/m', host.router);
  // module front-end bundles: /m/<id>/ui.js etc.
  app.use('/m/:id', (req, res, next) => {
    if (!/^[a-z0-9-]+$/.test(req.params.id)) return res.status(404).end();
    express.static(path.join(cfg.modulesDir, req.params.id, 'public'), { maxAge: '1h' })(req, res, next);
  });
  // Pages that carry the platform's name are rendered from the brand setting.
  const fs = require('fs');
  const indexTpl = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const escHtml = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const renderIndex = (req, res) => { const b = brain.brand; res.type('html').send(indexTpl.replace(/{{NAME}}/g, escHtml(b.name)).replace(/{{NAME_ML}}/g, escHtml(b.name_ml)).replace(/{{OWNER}}/g, escHtml(b.owner))); };
  app.get('/manifest.webmanifest', (req, res) => res.type('application/manifest+json').send(JSON.stringify({
    name: brain.brand.name, short_name: brain.brand.short, description: `${brain.brand.tagline} ${brain.brand.owner}.`,
    start_url: '/#/home', display: 'standalone', background_color: '#f6f8f5', theme_color: '#0b4f45',
    icons: [{ src: '/img/cif-mark.png', sizes: '256x256', type: 'image/png', purpose: 'any' }] })));
  app.get(['/', '/index.html'], renderIndex);
  app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, index: false }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));
  app.get('*', renderIndex);
  // last-resort error handler: never leak stack traces, never crash
  app.use((err, req, res, _next) => { console.error('[http]', err.message); if (!res.headersSent) res.status(err.status || 500).json({ error: 'error', message: err.status ? err.message : 'Internal error' }); });

  return { app, brain, host, sync, cfg };
}

if (require.main === module) {
  process.on('uncaughtException', (e) => console.error('[fatal-guard] uncaught', e));   // keep serving
  process.on('unhandledRejection', (e) => console.error('[fatal-guard] unhandled', e));
  const { app, sync, cfg, host } = createApp();
  app.listen(cfg.port, () => {
    console.log(`AADI ${cfg.role} node "${cfg.node}" on :${cfg.port} — modules: ${host.status().map((m) => `${m.id}(${m.state})`).join(', ') || 'none'}`);
    sync.start();
  });
}

module.exports = { createApp };
