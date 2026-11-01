'use strict';
// Test helper: boots a fresh demo node (temp DB, full seed) on a random port.
const os = require('os');
const path = require('path');
const fs = require('fs');
const { createApp } = require('../server');
const { seed } = require('../scripts/seed');

async function bootDemo({ node = 'test-' + process.pid + '-' + Math.random().toString(36).slice(2, 7), role = 'cloud', upstream = null, syncKey = 'test-key', hamlets = '', noSeed = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aadi-'));
  process.env.AADI_DEMO = '1';
  // Long demo boots must not race the channels outbox timer; tests drive the outbox themselves.
  if (!process.env.AADI_OUTBOX_INTERVAL_MS) process.env.AADI_OUTBOX_INTERVAL_MS = '120000';
  const ctx = createApp({ dbFile: path.join(dir, node + '.db'), node, role, upstream, syncKey, hamlets });
  const demo = noSeed ? null : await seed(ctx);
  const server = await new Promise((res) => { const s = ctx.app.listen(0, () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const tokens = {};
  async function req(token, method, p, body) {
    const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch (_) { json = text; }
    return { status: r.status, body: json };
  }
  async function login(username) {
    if (tokens[username]) return tokens[username];
    const r = await req(null, 'POST', '/api/core/auth/login', { username, password: 'demo1234' });
    if (r.status !== 200) throw new Error('login failed for ' + username + ': ' + JSON.stringify(r.body));
    return (tokens[username] = r.body.token);
  }
  // as('demo.facilitator').get('/api/m/learning/...')
  const as = (username) => ({
    get: async (p) => req(await login(username), 'GET', p),
    post: async (p, b = {}) => req(await login(username), 'POST', p, b),
    put: async (p, b = {}) => req(await login(username), 'PUT', p, b),
    del: async (p) => req(await login(username), 'DELETE', p),
  });
  const close = () => new Promise((res) => server.close(() => { try { ctx.brain.db.close(); } catch (_) { /* ignore */ } fs.rmSync(dir, { recursive: true, force: true }); res(); }));
  return { ...ctx, demo, base, req, login, as, close };
}

module.exports = { bootDemo };
