import { mkdir, writeFile } from 'node:fs/promises';

// Original, deterministic interface foley for the title and selection screens.
// menu-impact: cinematic boom for the title slam and the VS. menu-whoosh: air sweep for
// transitions and fighter swaps. menu-move: soft tick when the cursor moves.
// Run: node scripts/generate-menu-sounds.mjs
const rate = 44100;
await mkdir('public/assets/audio', { recursive: true });

function render(duration, sample) {
  const count = Math.ceil(duration * rate);
  const samples = new Float32Array(count);
  const state = { seed: 314159, low: 0, band: 0, phase: 0 };
  let peak = 0;
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
    const noise = state.seed / 2147483648 - 1;
    const tail = Math.min(1, (duration - t) / 0.03);
    samples[i] = sample(t, noise, state) * Math.min(1, t / 0.002) * tail;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  return { samples, peak };
}

const effects = {
  'menu-impact': render(0.9, (t, noise, s) => {
    // Sub drop from 95 Hz to 38 Hz plus a filtered crash that dies quickly.
    s.phase += 2 * Math.PI * (38 + 57 * Math.exp(-t * 9)) / rate;
    s.low += 0.12 * (noise - s.low);
    const boom = Math.sin(s.phase) * Math.exp(-t * 4.2);
    const knock = Math.sin(s.phase * 2.01) * Math.exp(-t * 16) * 0.45;
    const crash = (noise - s.low) * Math.exp(-t * 26) * 0.5 + s.low * Math.exp(-t * 7) * 0.9;
    return boom + knock + crash;
  }),
  'menu-whoosh': render(0.5, (t, noise, s) => {
    // Band-passed noise whose centre rises then falls: air passing the camera.
    const sweep = Math.sin(Math.PI * Math.min(1, t / 0.5));
    const cutoff = 0.02 + 0.22 * sweep;
    s.low += cutoff * (noise - s.low);
    s.band += cutoff * 0.5 * (s.low - s.band);
    return (s.low - s.band) * sweep * sweep;
  }),
  'menu-move': render(0.07, (t, noise, s) => {
    s.phase += 2 * Math.PI * (880 - 2600 * t) / rate;
    return Math.sin(s.phase) * Math.exp(-t * 70) + noise * Math.exp(-t * 320) * 0.25;
  }),
};

for (const [name, { samples, peak }] of Object.entries(effects)) {
  const count = samples.length;
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) wav.writeInt16LE(Math.round(samples[i] / peak * 0.85 * 32767), 44 + i * 2);
  await writeFile(`public/assets/audio/${name}.wav`, wav);
  console.log(`${name}: ${count} samples, ${wav.length} bytes`);
}
