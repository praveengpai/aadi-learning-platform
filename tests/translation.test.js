'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chunks } = require('../modules/translation');
const { bootDemo } = require('./helpers');

const B = '/api/m/translation';

test('long text is split under the provider limit on sentence boundaries', () => {
  const s = 'This is one sentence. '.repeat(120);
  const parts = chunks(s);
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(p.length <= 900);
  assert.equal(parts.join(' ').replace(/\s+/g, ' ').trim(), s.trim());
});

test('translation module', async (t) => {
  delete process.env.SARVAM_API_KEY;
  delete process.env.AADI_TRANSLATE_MOCK;
  const d = await bootDemo();
  t.after(() => d.close());

  await t.test('without a key: approved memory still works, new text says how to switch on', async () => {
    const st = await d.as('demo.teacher').get(B + '/status');
    assert.equal(st.body.configured, false);
    const hit = await d.as('demo.teacher').post(B + '/translate', { text: "Don't worry if you got it wrong. Try again." });
    assert.equal(hit.status, 200);
    assert.equal(hit.body.cached, true);
    assert.equal(hit.body.status, 'approved');
    assert.match(hit.body.target, /സാരമില്ല/);
    const miss = await d.as('demo.teacher').post(B + '/translate', { text: 'A brand new sentence.' });
    assert.equal(miss.status, 503);
    assert.match(miss.body.message, /Sarvam API key/);
  });

  await t.test('with the provider: glossary terms kept, result cached, usage counted, cap enforced', async () => {
    process.env.AADI_TRANSLATE_MOCK = '1';
    const r = await d.as('demo.teacher').post(B + '/translate', { text: 'The PSC class in your hamlet starts at 4 pm.' });
    assert.equal(r.status, 200);
    assert.equal(r.body.cached, false);
    assert.equal(r.body.status, 'machine');
    assert.match(r.body.target, /PSC/);
    assert.match(r.body.target, /ഊര്/, 'glossary: hamlet → ഊര്');
    assert.match(r.body.target, /modern-colloquial/, 'default style is everyday Malayalam');
    const again = await d.as('demo.facilitator').post(B + '/translate', { text: 'The  PSC class in your hamlet starts at 4 pm. ' });
    assert.equal(again.body.cached, true, 'same sentence is never paid for twice');
    const st = await d.as('demo.teacher').get(B + '/status');
    assert.ok(st.body.chars_this_month >= 40);
    assert.equal(st.body.requests, 1);
    process.env.AADI_TRANSLATE_MONTHLY_CAP = '50';
    const capped = await d.as('demo.teacher').post(B + '/translate', { text: 'This sentence would go over the monthly limit set by the administrator.' });
    assert.equal(capped.status, 429);
    delete process.env.AADI_TRANSLATE_MONTHLY_CAP;
  });

  await t.test('native-speaker review: correction becomes "edited" and is what everyone gets next', async () => {
    const q = await d.as('demo.teacher').get(B + '/memory?status=machine');
    const row = q.body[0];
    assert.ok(row);
    const rv = await d.as('demo.teacher').post(`${B}/memory/${row.id}/review`, { target: 'ഊരിലെ PSC ക്ലാസ് വൈകിട്ട് 4 മണിക്ക് തുടങ്ങും.' });
    assert.equal(rv.body.status, 'edited');
    const again = await d.as('demo.facilitator').post(B + '/translate', { text: row.source });
    assert.equal(again.body.target, 'ഊരിലെ PSC ക്ലാസ് വൈകിട്ട് 4 മണിക്ക് തുടങ്ങും.');
    const lk = await d.as('demo.learner').post(B + '/lookup', { texts: [row.source, 'unknown'] });
    assert.equal(lk.body[row.source].status, 'edited');
    assert.equal(lk.body.unknown, null);
  });

  await t.test('permissions', async () => {
    assert.equal((await d.as('demo.learner').post(B + '/translate', { text: 'hello' })).status, 403);
    assert.equal((await d.as('demo.donor').get(B + '/status')).status, 403);
    assert.equal((await d.as('demo.facilitator').post(B + '/glossary', { term: 'x', preferred: 'y' })).status, 403, 'only reviewers edit the glossary');
    const g = await d.as('demo.teacher').post(B + '/glossary', { term: 'notebook', preferred: 'നോട്ടുബുക്ക്' });
    assert.equal(g.status, 200);
  });
  delete process.env.AADI_TRANSLATE_MOCK;
});
