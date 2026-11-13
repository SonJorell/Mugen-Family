import { mkdir, writeFile } from 'node:fs/promises';

// Original announcer lines made with a small formant synthesizer: a glottal pulse train shaped by
// three cascaded resonators per phoneme, noise for fricatives and bursts, a deep falling pitch
// contour, light saturation and a stadium echo. No recordings or text-to-speech engines involved.
//   node scripts/generate-announcer.mjs   → public/assets/audio/announcer-*.wav

const RATE = 22050;
// Level of fricatives and stop bursts relative to the voiced sound.
const HISS = Number(process.env.HISS ?? 0.35);

// Formants (Hz) for a deep male voice. v = voiced amplitude, n = noise amplitude, nf = noise band.
const P = {
  a: { f: [730, 1190, 2440], v: 1 }, e: { f: [470, 1800, 2500], v: 1 }, i: { f: [300, 2200, 2950], v: 0.9 },
  o: { f: [480, 860, 2420], v: 1 }, u: { f: [320, 760, 2300], v: 0.9 },
  j: { f: [300, 2150, 2900], v: 0.7 }, w: { f: [330, 720, 2300], v: 0.7 },
  m: { f: [270, 1000, 2200], v: 0.45 }, n: { f: [270, 1500, 2500], v: 0.45 },
  l: { f: [360, 1250, 2650], v: 0.6 }, r: { f: [420, 1300, 1700], v: 0.35 },
  s: { f: [400, 1600, 2500], v: 0, n: 0.55, nf: [4200, 7800] },
  x: { f: [400, 1400, 2500], v: 0, n: 0.5, nf: [1300, 3200] },
  // Stops: closure then a burst; `loc` is the second-formant locus the next vowel starts from.
  p: { f: [300, 900, 2300], v: 0, stop: true, nf: [600, 1800], loc: 900 },
  b: { f: [300, 900, 2300], v: 0.25, stop: true, nf: [600, 1800], loc: 900 },
  t: { f: [300, 1750, 2600], v: 0, stop: true, nf: [3200, 6500], loc: 1800 },
  d: { f: [300, 1700, 2600], v: 0.25, stop: true, nf: [2800, 5500], loc: 1750 },
  k: { f: [300, 1900, 2400], v: 0, stop: true, nf: [1500, 3200], loc: 2000 },
  g: { f: [300, 1900, 2400], v: 0.25, stop: true, nf: [1400, 3000], loc: 1950 },
};

// Phrases as [phoneme, duration ms, stressed?]. Spanish spelling turned into sounds.
const LINES = {
  'round-1': 'r90 a120* w60 n70 d60 _90 u150* n70 o230',
  'round-2': 'r90 a120* w60 n70 d60 _90 d60 o170* s180',
  'round-3': 'r90 a120* w60 n70 d60 _90 t70 r40 e170* s180',
  'round-4': 'r90 a120* w60 n70 d60 _90 k70 w50 a140* t70 r40 o200',
  'round-5': 'r90 a120* w60 n70 d60 _90 s100 i140* n70 k70 o200',
  fight: 'p80 e110 l70 e170* a260',
  ko: 'k80 a220* _120 o320*',
  time: 't80 j60 e160* m80 p80 o240',
  victory: 'b60 i90 k70 t70 o170* r40 j50 a240',
  defeat: 'd60 e90 r110 o170* t70 a230',
  draw: 'e100 m80 p80 a170* t70 e220',
  'p1-wins': 'g70 a170* n70 a110 _70 x110 u80 g60 a90 d60 o170* r60 _60 u160* n70 o220',
  'p2-wins': 'g70 a170* n70 a110 _70 x110 u80 g60 a90 d60 o170* r60 _60 d60 o180* s200',
};

const NOISE = (() => { let seed = 41923; return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; }; })();

/** Two-pole resonator (Klatt). */
function resonator() {
  let y1 = 0, y2 = 0;
  return (x, f, bw) => {
    const c = -Math.exp(-2 * Math.PI * bw / RATE), b = 2 * Math.exp(-Math.PI * bw / RATE) * Math.cos(2 * Math.PI * f / RATE), a = 1 - b - c;
    const y = a * x + b * y1 + c * y2; y2 = y1; y1 = y; return y;
  };
}
/** One-pole band split for noise: high-pass then low-pass. */
function band() {
  let lp = 0, hpPrev = 0, hpOut = 0;
  return (x, lo, hi) => {
    const ah = Math.exp(-2 * Math.PI * lo / RATE), al = Math.exp(-2 * Math.PI * hi / RATE);
    hpOut = ah * (hpOut + x - hpPrev); hpPrev = x;
    lp = (1 - al) * hpOut + al * lp; return lp;
  };
}

function parse(text) {
  return text.split(/\s+/).map(token => {
    const m = token.match(/^([a-z_])(\d+)(\*?)$/);
    if (!m) throw new Error(`bad token ${token}`);
    return { ph: m[1], ms: Number(m[2]), stress: m[3] === '*' };
  });
}

function synth(text) {
  const segs = parse(text);
  const total = segs.reduce((s, x) => s + x.ms, 0) / 1000 + 0.05;
  const n = Math.ceil(total * RATE);
  const out = new Float32Array(n);
  const r1 = resonator(), r2 = resonator(), r3 = resonator(), nb = band();
  let phase = 0, t = 0, prevF = [500, 1500, 2500];
  const stressPoints = [];
  let cursor = 0;
  for (const s of segs) { if (s.stress) stressPoints.push((cursor + s.ms / 2) / 1000); cursor += s.ms; }
  let i = 0;
  segs.forEach((seg, index) => {
    const len = Math.round(seg.ms / 1000 * RATE);
    const p = seg.ph === '_' ? null : P[seg.ph];
    const target = p ? p.f : prevF;
    // Vowels after a stop glide from the stop's locus; everything blends from the previous sound.
    const start = [...prevF];
    const prev = index > 0 ? P[segs[index - 1].ph] : null;
    if (prev?.stop && p && !p.stop) start[1] = prev.loc;
    for (let k = 0; k < len && i < n; k++, i++) {
      t = i / RATE;
      const u = k / len, blend = Math.min(1, u / 0.35);
      const f = target.map((v, j) => start[j] + (v - start[j]) * blend);
      // Pitch: a deep base with a lift on stressed syllables and a fall at the end of the line.
      let pitch = 92 - 18 * (t / total);
      for (const sp of stressPoints) pitch += 22 * Math.exp(-(((t - sp) / 0.09) ** 2));
      pitch *= 1 + 0.012 * Math.sin(t * 2 * Math.PI * 5.5);
      phase = (phase + pitch / RATE) % 1;
      // Rosenberg-like glottal flow, differentiated (radiation at the lips).
      const flow = phase < 0.45 ? 0.5 * (1 - Math.cos(Math.PI * phase / 0.45)) : phase < 0.6 ? Math.cos(Math.PI * (phase - 0.45) / 0.3) : 0;
      let voicing = p ? p.v : 0;
      let noiseAmp = p?.n ?? 0, nf = p?.nf ?? [1000, 4000];
      if (p?.stop) {
        // 70 % closure (silence or a low murmur), then a 30 ms burst and a little aspiration.
        const burstAt = 0.7;
        voicing = u < burstAt ? p.v : p.v * 0.6;
        noiseAmp = u >= burstAt ? (u < burstAt + 0.15 ? 0.9 : 0.25) : 0;
      }
      if (seg.ph === 'r') voicing *= 0.55 + 0.45 * Math.abs(Math.cos(Math.PI * 2 * 26 * t)); // tap/trill flutter
      // Fade in and out of every segment to avoid clicks.
      const edge = Math.min(1, k / (RATE * 0.008), (len - k) / (RATE * 0.008));
      const source = (flow - (out._lastFlow ?? 0)) * 18; out._lastFlow = flow;
      const breath = NOISE() * 0.04;
      let v = r1(source * voicing + breath * voicing, f[0], 90);
      v = r2(v, f[1], 110);
      v = r3(v, f[2], 170);
      const hiss = nb(NOISE(), nf[0], nf[1]) * noiseAmp * HISS;
      out[i] = (v * 0.9 + hiss) * edge;
    }
    if (p) prevF = [...target];
  });
  return out;
}

/** Saturation, an octave-down shadow for weight, and a stadium echo. */
function master(dry) {
  const tail = Math.round(RATE * 0.9);
  const n = dry.length + tail;
  const out = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < dry.length; i++) peak = Math.max(peak, Math.abs(dry[i]));
  const norm = peak ? 1 / peak : 1;
  const sub = resonator();
  for (let i = 0; i < dry.length; i++) {
    const x = Math.tanh(dry[i] * norm * 1.8) * 0.8;
    out[i] += x + sub(x, 180, 120) * 0.35;
  }
  for (const [delay, gain] of [[0.083, 0.32], [0.147, 0.22], [0.231, 0.15], [0.337, 0.09], [0.48, 0.05]]) {
    const d = Math.round(delay * RATE);
    for (let i = 0; i < dry.length; i++) out[i + d] += out[i] * gain * 0.6;
  }
  return out;
}

function wav(samples) {
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(RATE, 24); buffer.writeUInt32LE(RATE * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buffer.writeInt16LE(Math.round(samples[i] / peak * 0.85 * 32767), 44 + i * 2);
  return buffer;
}

await mkdir('public/assets/audio', { recursive: true });
for (const [name, text] of Object.entries(LINES)) {
  const data = wav(master(synth(text)));
  await writeFile(`public/assets/audio/announcer-${name}.wav`, data);
  console.log(`announcer-${name}.wav  ${(data.length / 1024).toFixed(0)} KB`);
}
