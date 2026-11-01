'use strict';
// Server-side checks for audio recorded in the browser (MediaRecorder: opus in WebM/Ogg, or AAC in MP4).
// We never trust the browser's MIME label or its stated duration on their own: the bytes must match the
// container's signature, and where the container lets us, the duration is measured from the file itself.
// Also builds the tiny synthetic WAV tones used by the demo seed (no real recordings anywhere).

const MAX_BYTES = 400 * 1024;
const MAX_SECONDS = 90;
const TOLERANCE_S = 0.5;
// Containers we accept, keyed by the MIME base type the data URL declares.
const TYPES = {
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/x-m4a': 'mp4', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
};

const fail = (msg) => Object.assign(new Error(msg), { status: 400 });

function sniff(buf) {
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  if (buf.length >= 4 && buf.toString('latin1', 0, 4) === 'OggS') return 'ogg';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WAVE') return 'wav';
  if (buf.length >= 8 && buf.toString('latin1', 4, 8) === 'ftyp') return 'mp4';
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xf6) === 0xf0) return 'aac';
  return null;
}

// ---- duration readers (best effort; null when the container does not say) ----
function wavDuration(buf) {
  let off = 12, byteRate = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('latin1', off, off + 4); const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ' && off + 16 <= buf.length) byteRate = buf.readUInt32LE(off + 16);
    if (id === 'data') return byteRate > 0 ? Math.min(size, buf.length - off - 8) / byteRate : null;
    off += 8 + size + (size % 2);
  }
  return null;
}
// Walk Ogg pages from the start; they must tile the buffer exactly (no bytes after the last page).
function oggPages(buf) {
  let off = 0, last = -1, guard = 0;
  while (off < buf.length) {
    if (guard++ > 100000 || off + 27 > buf.length || buf.toString('latin1', off, off + 4) !== 'OggS' || buf[off + 4] !== 0) return null;
    const segs = buf[off + 26];
    if (off + 27 + segs > buf.length) return null;
    let body = 0;
    for (let i = 0; i < segs; i++) body += buf[off + 27 + i];
    const next = off + 27 + segs + body;
    if (next > buf.length) return null;
    last = off; off = next;
  }
  return last >= 0 ? { last } : null;
}
function oggDuration(buf) {
  // Opus in Ogg always counts granule positions at 48 kHz (RFC 7845); other codecs: unknown here.
  if (buf.indexOf('OpusHead', 0, 'latin1') < 0) return null;
  const pages = oggPages(buf);
  if (!pages) return null;
  const g = Number(buf.readBigInt64LE(pages.last + 6));
  let preSkip = 0;
  const head = buf.indexOf('OpusHead', 0, 'latin1');
  if (head >= 0 && head + 12 <= buf.length) preSkip = buf.readUInt16LE(head + 10);
  return g > 0 ? Math.max(0, g - preSkip) / 48000 : null;
}
function mp4Duration(buf) {
  const i = buf.indexOf('mvhd', 0, 'latin1');
  if (i < 4) return null;
  const v = buf[i + 4];
  try {
    if (v === 1) { const ts = buf.readUInt32BE(i + 24); const d = Number(buf.readBigUInt64BE(i + 28)); return ts ? d / ts : null; }
    const ts = buf.readUInt32BE(i + 16); const d = buf.readUInt32BE(i + 20); return ts ? d / ts : null;
  } catch (_) { return null; }
}
function aacFrames(buf) {
  const RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  let off = 0, frames = 0, rate = 0;
  while (off + 7 <= buf.length && buf[off] === 0xff && (buf[off + 1] & 0xf6) === 0xf0) {
    rate = RATES[(buf[off + 2] >> 2) & 0x0f] || rate;
    const len = ((buf[off + 3] & 0x03) << 11) | (buf[off + 4] << 3) | (buf[off + 5] >> 5);
    if (len < 7 || off + len > buf.length) break;
    frames++; off += len;
  }
  return { frames, rate, end: off };
}
function aacDuration(buf) {
  const { frames, rate } = aacFrames(buf);
  return rate && frames ? (frames * 1024) / rate : null;
}
// WebM (Matroska): walk EBML elements; MediaRecorder writes unknown-size Segment/Cluster, so masters
// we care about are entered in place. Duration = Info/Duration if present, else the last block's time.
// `exact` is true only when the elements tile the whole buffer and a sized Segment ends at its end.
function webmParse(buf) {
  const vint = (o, keepMarker) => {
    const b = buf[o]; if (b === undefined) return null;
    let len = 1, mask = 0x80; while (len <= 8 && !(b & mask)) { mask >>= 1; len++; }
    if (len > 8 || o + len > buf.length) return null;
    let val = keepMarker ? b : b & (mask - 1); let allOnes = (b & (mask - 1)) === mask - 1;
    for (let k = 1; k < len; k++) { val = val * 256 + buf[o + k]; if (buf[o + k] !== 0xff) allOnes = false; }
    return { val, len, unknown: !keepMarker && allOnes };
  };
  const MASTERS = new Set([0x18538067 /* Segment */, 0x1549a766 /* Info */, 0x1f43b675 /* Cluster */, 0xa0 /* BlockGroup */]);
  let off = 0, scale = 1e6, infoDur = null, cluster = 0, maxT = 0, guard = 0, broke = false, segEnd = null;
  while (off < buf.length) {
    if (guard++ >= 200000) { broke = true; break; }
    const id = vint(off, true); if (!id || id.len > 4) { broke = true; break; }
    const sz = vint(off + id.len, false); if (!sz) { broke = true; break; }
    const data = off + id.len + sz.len;
    if (MASTERS.has(id.val)) {
      if (id.val === 0x18538067 && !sz.unknown) segEnd = data + sz.val;
      if (!sz.unknown && data + sz.val > buf.length) { broke = true; break; }
      off = data; continue;
    }
    if (sz.unknown || data + sz.val > buf.length) { broke = true; break; }
    if (id.val === 0x2ad7b1) { let v = 0; for (let k = 0; k < sz.val; k++) v = v * 256 + buf[data + k]; scale = v || scale; }
    else if (id.val === 0x4489) infoDur = sz.val === 8 ? buf.readDoubleBE(data) : sz.val === 4 ? buf.readFloatBE(data) : null;
    else if (id.val === 0xe7) { let v = 0; for (let k = 0; k < sz.val; k++) v = v * 256 + buf[data + k]; cluster = v; maxT = Math.max(maxT, cluster); }
    else if (id.val === 0xa3 || id.val === 0xa1) { const tn = vint(data, false); if (tn && data + tn.len + 2 <= buf.length) maxT = Math.max(maxT, cluster + buf.readInt16BE(data + tn.len)); }
    off = data + sz.val;
  }
  let duration = null;
  if (infoDur && infoDur > 0) duration = (infoDur * scale) / 1e9;
  else if (maxT > 0) duration = (maxT * scale) / 1e9 + 0.02;
  return { duration, exact: !broke && off === buf.length && (segEnd === null || segEnd === buf.length) };
}
const webmDuration = (buf) => webmParse(buf).duration;

// ---- structure checks: the container must end where the audio ends (nothing hidden after it) ----
// WAV: the RIFF size must cover exactly the file, and its chunks (only fmt/fact/data/small LIST) must
// tile it — a missing final pad byte after an odd-sized last chunk is tolerated.
function wavExact(buf) {
  if (buf.length < 12) return false;
  const end = 8 + buf.readUInt32LE(4);
  if (end !== buf.length) return false;
  let off = 12, fmt = 0, data = 0;
  while (off < end) {
    if (off + 8 > end) return false;
    const id = buf.toString('latin1', off, off + 4); const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt++; else if (id === 'data') data++;
    else if (id === 'LIST') { if (size > 4096) return false; } else if (id !== 'fact') return false;
    const next = off + 8 + size;
    if (next > end) return false;
    if (next === end) { off = next; break; }
    off = next + (size % 2);
  }
  return off === end && fmt === 1 && data === 1;
}
// MP4: top-level boxes must tile the file exactly; free-form boxes are kept small.
const MP4_TOP = new Set(['ftyp', 'styp', 'moov', 'mdat', 'moof', 'mfra', 'free', 'skip', 'wide', 'sidx', 'uuid', 'meta', 'pdin', 'emsg', 'prft']);
function mp4Exact(buf) {
  let off = 0, first = true;
  while (off < buf.length) {
    if (off + 8 > buf.length) return false;
    let size = buf.readUInt32BE(off); let hdr = 8;
    const type = buf.toString('latin1', off + 4, off + 8);
    if (size === 1) { if (off + 16 > buf.length) return false; size = Number(buf.readBigUInt64BE(off + 8)); hdr = 16; } else if (size === 0) size = buf.length - off;
    if (size < hdr || off + size > buf.length) return false;
    if (first && type !== 'ftyp') return false;
    if (!MP4_TOP.has(type)) return false;
    if (['free', 'skip', 'wide', 'uuid'].includes(type) && size > 16384) return false;
    first = false; off += size;
  }
  return !first;
}
const EXACT = {
  wav: wavExact,
  ogg: (buf) => !!oggPages(buf),
  webm: (buf) => webmParse(buf).exact,
  mp4: mp4Exact,
  aac: (buf) => { const f = aacFrames(buf); return f.frames > 0 && f.end === buf.length; },
};
const READERS = { wav: wavDuration, ogg: oggDuration, mp4: mp4Duration, aac: aacDuration, webm: webmDuration };

// Validate a data URL. Returns { mime, container, bytes, duration_s, duration_source, buffer }.
function validateAudio(dataUrl, reportedSeconds) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) throw fail('Record the clip first (no audio received).');
  if (dataUrl.length > Math.ceil(MAX_BYTES / 3) * 4 + 200) throw fail('The clip is too large — keep it under 400 KB (about 90 seconds).');
  const m = /^data:([a-z0-9.+/-]+)((?:;[a-z0-9_-]+=[a-z0-9.,"'_ -]+)*);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!m) throw fail('Audio must be sent as a base64 data URL.');
  const mime = m[1].toLowerCase();
  const container = TYPES[mime];
  if (!container) throw fail('Only audio recordings are accepted (WebM/Ogg Opus, MP4/AAC or WAV).');
  const buffer = Buffer.from(m[3].replace(/\s+/g, ''), 'base64');
  if (!buffer.length) throw fail('The recording is empty.');
  if (buffer.length > MAX_BYTES) throw fail('The clip is too large — keep it under 400 KB (about 90 seconds).');
  const real = sniff(buffer);
  if (real !== container) throw fail('The file is not the kind of audio it claims to be.');
  let exact = false;
  try { exact = EXACT[container](buffer); } catch (_) { exact = false; }
  if (!exact) throw fail('The recording is damaged or has extra data after the audio — please record again.');
  let measured = null;
  try { measured = READERS[container](buffer); } catch (_) { measured = null; }
  const rep = Number(reportedSeconds);
  let duration = null, source = null;
  if (measured !== null && Number.isFinite(measured) && measured > 0) { duration = measured; source = 'measured'; }
  else if (Number.isFinite(rep) && rep > 0) { duration = rep; source = 'reported'; }
  if (duration === null) throw fail('Could not tell how long the clip is — please record again.');
  if (duration > MAX_SECONDS + TOLERANCE_S) throw fail(`The clip is ${Math.round(duration)} seconds — keep it to ${MAX_SECONDS} seconds or less.`);
  // A stated length that is much shorter than the measured one is a mismatch worth refusing.
  if (source === 'measured' && Number.isFinite(rep) && rep > 0 && rep + 5 < duration) throw fail('The stated length does not match the recording.');
  return { mime, container, bytes: buffer.length, duration_s: Math.round(duration * 10) / 10, duration_source: source, buffer };
}

// A small synthetic WAV (8 kHz, 8-bit mono): a soft two-note chime with fades — clearly not speech.
function syntheticWav(seconds = 2, freqs = [523.25, 659.25], rate = 8000) {
  const n = Math.round(seconds * rate);
  const buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0, 'latin1'); buf.writeUInt32LE(36 + n, 4); buf.write('WAVE', 8, 'latin1');
  buf.write('fmt ', 12, 'latin1'); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34);
  buf.write('data', 36, 'latin1'); buf.writeUInt32LE(n, 40);
  const seg = Math.ceil(n / freqs.length);
  for (let i = 0; i < n; i++) {
    const f = freqs[Math.min(freqs.length - 1, Math.floor(i / seg))];
    const local = i % seg;
    const env = Math.min(1, local / 400, (seg - local) / 800);
    buf[44 + i] = 128 + Math.round(40 * env * Math.sin((2 * Math.PI * f * i) / rate));
  }
  return 'data:audio/wav;base64,' + buf.toString('base64');
}

module.exports = { validateAudio, syntheticWav, sniff, MAX_BYTES, MAX_SECONDS, TYPES };
