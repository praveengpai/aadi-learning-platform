'use strict';
// AADI Safeguarding — keyword safety filter for user-generated text (mentor chat, posts).
// Pure function, no I/O: other modules may require('../safeguarding/filter') and must fall
// back gracefully if this module is absent. Rules err on the side of holding a message for a
// human moderator — a held message is delayed, never lost.

const RULES = [
  {
    id: 'contact_number', label: 'Shares a phone number', label_ml: 'ഫോൺ നമ്പർ പങ്കുവെക്കുന്നു', weight: 2,
    test: (s) => {
      const runs = s.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
      return runs.some((r) => r.replace(/\D/g, '').length >= 10);
    },
  },
  { id: 'contact_email', label: 'Shares an email address', label_ml: 'ഇമെയിൽ വിലാസം', weight: 2, test: (s) => /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(s) },
  {
    id: 'contact_app', label: 'Moves chat to a private app', label_ml: 'സ്വകാര്യ ആപ്പിലേക്ക് മാറ്റാൻ ശ്രമം', weight: 2,
    test: (s) => /\b(whats\s?app|insta(gram)?|snap(chat)?|telegram|signal|facebook|messenger|fb)\b/i.test(s) && /\b(add|dm|message|ping|chat|call|text|number|id|handle|follow)\b/i.test(s)
      || /\b(dm me|text me|call me|ping me|add me)\b/i.test(s) || /വാട്ട്സ്ആപ്പ്|ഇൻസ്റ്റ/.test(s),
  },
  {
    id: 'meeting_request', label: 'Asks to meet in person / alone', label_ml: 'നേരിൽ / ഒറ്റയ്ക്ക് കാണാൻ ആവശ്യപ്പെടുന്നു', weight: 3,
    test: (s) => /\b(meet (me|up|you)|let'?s meet|come (alone|to my|over)|see you (alone|outside|after)|pick you up|my (house|room|place|flat)|hotel room|alone with me|without (your )?(parents|teacher|anyone))\b/i.test(s)
      || /ഒറ്റയ്ക്ക്|നേരിൽ കാണാം|വീട്ടിലേക്ക് വാ|എന്നെ കാണാൻ വരൂ/.test(s),
  },
  {
    id: 'secrecy', label: 'Asks to keep secrets / delete chat', label_ml: 'രഹസ്യം സൂക്ഷിക്കാൻ ആവശ്യപ്പെടുന്നു', weight: 3,
    test: (s) => /\b(don'?t tell|do not tell|keep (this|it) (a )?secret|our (little )?secret|between (us|you and me)|delete (this|the|these) (chat|message|messages)|nobody needs to know)\b/i.test(s)
      || /ആരോടും പറയരുത്|രഹസ്യമായി|നമ്മുടെ രഹസ്യം/.test(s),
  },
  {
    id: 'inappropriate', label: 'Inappropriate / personal-body language', label_ml: 'അനുചിതമായ ഭാഷ', weight: 3,
    test: (s) => /\b(sexy|nude|naked|undress|send (me )?(a |your )?(pic|pics|photo|photos|selfie)|photo of you|your body|kiss|i love you|be my (girlfriend|boyfriend)|date with me|hot girl|hot boy)\b/i.test(s)
      || /ഫോട്ടോ അയക്ക്|നിന്റെ ഫോട്ടോ|ഉമ്മ/.test(s),
  },
  {
    id: 'gifts_money', label: 'Offers money, gifts or recharge', label_ml: 'പണം / സമ്മാനം വാഗ്ദാനം', weight: 2,
    test: (s) => /\b(i'?ll (send|give) you (money|a gift|a phone)|send you money|recharge (your|for you)|buy you a (phone|gift)|gift for you|pay you)\b/i.test(s) || /പണം തരാം|റീചാർജ് ചെയ്തു തരാം/.test(s),
  },
  {
    id: 'self_harm_or_danger', label: 'Possible danger / distress words', label_ml: 'അപകട / വിഷമ സൂചന', weight: 4,
    test: (s) => /\b(hurt (me|myself)|kill (myself|me)|want to die|hit me|beats? me|scared to go home|touched me|run away)\b/i.test(s) || /മരിക്കണം|എന്നെ അടിക്കും|പേടിയാണ്/.test(s),
  },
];

function scan(text) {
  const s = String(text || '');
  const hits = RULES.filter((r) => { try { return r.test(s); } catch (_) { return false; } });
  const score = hits.reduce((a, r) => a + r.weight, 0);
  return {
    flagged: hits.length > 0,
    reasons: hits.map((r) => r.id),
    labels: hits.map((r) => ({ id: r.id, en: r.label, ml: r.label_ml })),
    severity: score >= 4 || hits.some((r) => r.id === 'self_harm_or_danger') ? 'high' : score >= 3 ? 'medium' : hits.length ? 'low' : 'none',
  };
}

// Mask contact details in an excerpt so moderators can judge context without copying numbers around.
function mask(text) {
  return String(text || '')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, (m) => (m.replace(/\D/g, '').length >= 10 ? '[number hidden]' : m))
    .replace(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi, '[email hidden]');
}

module.exports = { scan, mask, RULES: RULES.map(({ id, label, label_ml, weight }) => ({ id, label, label_ml, weight })) };
