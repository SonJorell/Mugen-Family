import { mkdir, writeFile } from 'node:fs/promises';

// Original, deterministic arcade foley: a short noise transient layered over a low thump.
// No downloaded samples or runtime synthesis; PCM WAV works with both Phaser audio backends.
const rate = 44100;
await mkdir('public/assets/audio', { recursive: true });
const effects = [
  { name: 'hit-light', duration: 0.16, pitch: 155, decay: 34, noise: 0.48, body: 0.65 },
  { name: 'hit-heavy', duration: 0.26, pitch: 105, decay: 19, noise: 0.6, body: 0.9 },
  { name: 'hit-special', duration: 0.38, pitch: 125, decay: 14, noise: 0.55, body: 0.85 },
  { name: 'hit-block', duration: 0.14, pitch: 320, decay: 38, noise: 0.7, body: 0.35 },
];
for (const effect of effects) {
  const count = Math.ceil(effect.duration * rate);
  const samples = new Float32Array(count);
  let seed = 271828, low = 0, phase = 0, peak = 0;
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    low += 0.24 * (noise - low);
    phase += 2 * Math.PI * effect.pitch * (0.4 + 0.6 * Math.exp(-t * 32)) / rate;
    const attack = Math.min(1, t / 0.0015);
    const tail = Math.min(1, (effect.duration - t) / 0.025);
    const thump = Math.sin(phase) * Math.exp(-t * effect.decay) * effect.body;
    const crack = (noise - low * 0.7) * Math.exp(-t * 65) * effect.noise;
    const special = effect.name === 'hit-special' ? low * Math.exp(-t * 11) * 0.7 : 0;
    samples[i] = (thump + crack + special) * attack * tail;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) wav.writeInt16LE(Math.round(samples[i] / peak * 0.85 * 32767), 44 + i * 2);
  await writeFile(`public/assets/audio/${effect.name}.wav`, wav);
  console.log(`${effect.name}: ${count} samples, ${wav.length} bytes`);
}
