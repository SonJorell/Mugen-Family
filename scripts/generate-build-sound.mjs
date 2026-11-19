import { writeFile } from 'node:fs/promises';

// Original arcade foley: ball thump, wooden assembly, steps and five blaster bursts.
const rate = 44100, duration = 5.2, samples = new Float32Array(rate * duration);
let seed = 2026, peak = 0;
const pulse = (age, decay) => age >= 0 ? Math.exp(-age * decay) : 0;
for (let i = 0; i < samples.length; i++) {
  const t = i / rate;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const noise = seed / 2147483648 - 1;
  let v = (Math.sin(t * 2 * Math.PI * 90) * 0.8 + noise * 0.2) * pulse(t, 17);
  for (const at of [0.92, 1.09, 1.26, 1.43, 1.6, 1.77, 1.94, 2.12, 2.28, 2.44]) {
    const a = t - at;
    v += (noise * 0.38 + Math.sin(a * 2 * Math.PI * 310) * 0.25) * pulse(a, 36);
  }
  for (const at of [2.85, 3.2, 3.55, 3.9, 4.35]) {
    const a = t - at, power = at === 4.35 ? 1.2 : 0.8;
    v += power * (Math.sin(2 * Math.PI * (760 * a - 580 * a * a)) * 0.5 + noise * 0.35) * pulse(a, 14);
    v += power * Math.sin(a * Math.PI * 2 * 65) * pulse(a, 20) * 0.4;
  }
  samples[i] = v * Math.max(0, Math.min(1, t / 0.004, (duration - t) / 0.035));
  peak = Math.max(peak, Math.abs(samples[i]));
}
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(samples[i] / peak * 0.86 * 32767), 44 + i * 2);
await writeFile('public/assets/audio/super-build.wav', wav);
console.log(`super-build.wav: ${duration}s, ${wav.length} bytes`);
