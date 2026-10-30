'use strict';
// Pluggable delivery providers for the channels module.
//
// Interface (every provider):
//   { name, channels: ['sms'|'ivr'|'whatsapp'|'app'], live: boolean,
//     async send({ channel, to, message, lang, ref }) → { ok, provider_id?, error?, cost_paise? } }
//
// In the DEMO (AADI_DEMO=1) or unless AADI_CHANNELS_LIVE=1 is set, only the simulator is used and
// NO external service is ever called. Real gateways are selected by env vars:
//   SMS       : AADI_SMS_PROVIDER=msg91       MSG91_AUTH_KEY, MSG91_SENDER, MSG91_TEMPLATE_ID
//   IVR       : AADI_IVR_PROVIDER=exotel      EXOTEL_SID, EXOTEL_TOKEN, EXOTEL_CALLER_ID, EXOTEL_FLOW_URL
//   WhatsApp  : AADI_WA_PROVIDER=whatsapp     WA_PHONE_NUMBER_ID, WA_TOKEN, WA_TEMPLATE
// (DLT-registered templates are mandatory for SMS in India; the template id is passed through.)

const crypto = require('crypto');

// Deterministic pseudo-random in [0,1) from a string — reproducible demo outcomes.
const unit = (s) => parseInt(crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 8), 16) / 0x100000000;

// Segments for SMS cost: GSM-7 = 160 chars, Unicode (Malayalam) = 70 chars.
function smsSegments(text) {
  const uni = /[^\x00-\x7F]/.test(text);
  const per = uni ? (text.length > 70 ? 67 : 70) : (text.length > 160 ? 153 : 160);
  return Math.max(1, Math.ceil(text.length / per));
}

function simulator({ connectivityOf }) {
  // Failure odds rise where the network is weak. The simulator records what *would* happen.
  const FAIL = { none: 0.22, '2g': 0.08, '4g': 0.02 };
  return {
    name: 'simulator', channels: ['sms', 'ivr', 'whatsapp', 'app'], live: false,
    async send({ channel, to, message, ref, attempt = 1, hamlet_id }) {
      if (channel === 'app') return { ok: true, provider_id: 'app-' + ref, cost_paise: 0 };
      if (!to) return { ok: false, error: 'no phone on record' };
      const conn = connectivityOf(hamlet_id) || '2g';
      let p = FAIL[conn] ?? 0.08;
      if (channel === 'whatsapp' && conn !== '4g') p += 0.25; // needs data
      if (channel === 'ivr') p += 0.06;                       // unanswered calls
      const r = unit(ref + ':' + attempt);
      if (r < p) return { ok: false, error: channel === 'ivr' ? 'call not answered' : channel === 'whatsapp' ? 'no data connection' : 'handset unreachable' };
      const cost = channel === 'sms' ? smsSegments(message) * 18 : channel === 'ivr' ? 60 + Math.ceil(message.length / 15) * 5 : 35;
      return { ok: true, provider_id: 'sim-' + crypto.createHash('sha1').update(ref + attempt).digest('hex').slice(0, 10), cost_paise: cost };
    },
  };
}

// ---- real gateways (only constructed when explicitly enabled) ----
function msg91(env) {
  return {
    name: 'msg91', channels: ['sms'], live: true,
    async send({ to, message }) {
      const r = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST', headers: { authkey: env.MSG91_AUTH_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ template_id: env.MSG91_TEMPLATE_ID, sender: env.MSG91_SENDER, short_url: '0', recipients: [{ mobiles: '91' + to, message }] }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await r.json().catch(() => ({}));
      return r.ok && body.type !== 'error' ? { ok: true, provider_id: body.request_id || body.message, cost_paise: null } : { ok: false, error: body.message || 'HTTP ' + r.status };
    },
  };
}
function exotel(env) {
  return {
    name: 'exotel', channels: ['ivr'], live: true,
    async send({ to }) {
      const auth = Buffer.from(env.EXOTEL_SID + ':' + env.EXOTEL_TOKEN).toString('base64');
      const form = new URLSearchParams({ From: '0' + to, CallerId: env.EXOTEL_CALLER_ID, Url: env.EXOTEL_FLOW_URL });
      const r = await fetch(`https://api.exotel.com/v1/Accounts/${env.EXOTEL_SID}/Calls/connect.json`, { method: 'POST', headers: { authorization: 'Basic ' + auth, 'content-type': 'application/x-www-form-urlencoded' }, body: form, signal: AbortSignal.timeout(15000) });
      const body = await r.json().catch(() => ({}));
      return r.ok ? { ok: true, provider_id: body.Call && body.Call.Sid } : { ok: false, error: (body.RestException && body.RestException.Message) || 'HTTP ' + r.status };
    },
  };
}
function whatsapp(env) {
  return {
    name: 'whatsapp-cloud', channels: ['whatsapp'], live: true,
    async send({ to, message, lang }) {
      const r = await fetch(`https://graph.facebook.com/v19.0/${env.WA_PHONE_NUMBER_ID}/messages`, {
        method: 'POST', headers: { authorization: 'Bearer ' + env.WA_TOKEN, 'content-type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: '91' + to, type: 'template', template: { name: env.WA_TEMPLATE, language: { code: lang === 'ml' ? 'ml' : 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text: message.slice(0, 1000) }] }] } }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await r.json().catch(() => ({}));
      return r.ok ? { ok: true, provider_id: body.messages && body.messages[0] && body.messages[0].id } : { ok: false, error: (body.error && body.error.message) || 'HTTP ' + r.status };
    },
  };
}

function makeProviders({ env = process.env, connectivityOf }) {
  const sim = simulator({ connectivityOf });
  const live = env.AADI_CHANNELS_LIVE === '1' && env.AADI_DEMO !== '1';
  const table = { sms: sim, ivr: sim, whatsapp: sim, app: sim };
  const configured = [];
  if (live) {
    if (env.AADI_SMS_PROVIDER === 'msg91' && env.MSG91_AUTH_KEY) { table.sms = msg91(env); configured.push('sms:msg91'); }
    if (env.AADI_IVR_PROVIDER === 'exotel' && env.EXOTEL_SID) { table.ivr = exotel(env); configured.push('ivr:exotel'); }
    if (env.AADI_WA_PROVIDER === 'whatsapp' && env.WA_TOKEN) { table.whatsapp = whatsapp(env); configured.push('whatsapp:cloud-api'); }
  }
  return {
    live, configured,
    for: (channel) => table[channel] || sim,
    describe: () => Object.fromEntries(Object.entries(table).map(([ch, p]) => [ch, { provider: p.name, live: p.live }])),
  };
}

module.exports = { makeProviders, smsSegments, unit };
