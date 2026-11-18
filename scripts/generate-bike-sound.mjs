import { writeFile } from 'node:fs/promises';

// Original synthesized foley, synchronized to TataBikeSequence's six-second clock.
const rate = 44100, duration = 6, samples = new Float32Array(rate * duration);
let seed = 165, peak = 0;
const decay = (age, speed) => age < 0 ? 0 : Math.exp(-age * speed);
for (let i = 0; i < samples.length; i++) {
  const t = i / rate;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const noise = seed / 2147483648 - 1;
  let v = (Math.sin(t * Math.PI * 2 * 84) + noise * 0.15) * decay(t, 22) * 0.6;
  const cap = t - 0.65;
  v += (noise * 0.6 + Math.sin(cap * Math.PI * 2 * 1700) * 0.2) * decay(cap, 45);
  for (const at of [0.82, 1.01, 1.16]) {
    const a = t - at;
    v += Math.sin(2 * Math.PI * (240 * a + 220 * a * a)) * decay(a, 29) * 0.35;
  }
  for (const at of [1.42, 1.65, 1.88, 2.08, 2.3, 2.48, 2.64, 2.8, 2.93, 3.06, 3.19, 3.33,
    3.85, 4.05, 4.25, 4.45, 4.65]) {
    const a = t - at;
    v += (Math.sin(a * Math.PI * 2 * 540) * 0.2 + noise * 0.15) * decay(a, 65);
  }
  for (const at of [2.2, 2.42, 5.5]) {
    const a = t - at;
    v += (Math.sin(a * Math.PI * 2 * 1450) + Math.sin(a * Math.PI * 2 * 2317) * 0.45) * decay(a, 8) * 0.2;
  }
  if (t >= 2.4 && t < 3.7) v += noise * Math.min(0.2, (t - 2.4) * 0.15);
  for (const [at, power] of [[3.2, 1], [3.75, 0.65]]) {
    const a = t - at;
    v += (Math.sin(2 * Math.PI * (95 * a - 24 * a * a)) + noise * 0.65) * decay(a, 11) * power;
  }
  const brake = t - 4.55;
  v += (Math.sin(2 * Math.PI * (1900 * brake - 1300 * brake * brake)) * 0.2 + noise * 0.1) * decay(brake, 9);
  samples[i] = v * Math.max(0, Math.min(1, t / 0.005, (duration - t) / 0.04));
  peak = Math.max(peak, Math.abs(samples[i]));
}
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(samples[i] / peak * 0.85 * 32767), 44 + i * 2);
await writeFile('public/assets/audio/super-bike.wav', wav);
console.log(`super-bike.wav: ${duration}s, ${wav.length} bytes`);
