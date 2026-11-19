import { writeFile } from 'node:fs/promises';

// Original synthesized stomach hit, teleport, golden power-up and energy beam. No sampled dialogue.
const rate = 44100, duration = 6.8, samples = new Float32Array(rate * duration);
let seed = 1126, peak = 0;
const pulse = (t, decay) => t >= 0 ? Math.exp(-t * decay) : 0;
const span = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
for (let i = 0; i < samples.length; i++) {
  const t = i / rate;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const noise = seed / 2147483648 - 1;
  let v = (Math.sin(t * Math.PI * 2 * 78) * 0.9 + noise * 0.3) * pulse(t, 18);
  for (const at of [0.65, 0.89]) {
    const a = t - at;
    v += (Math.sin(Math.PI * 2 * (1150 * a - 1700 * a * a)) * 0.45 + noise * 0.14) * pulse(a, 26);
  }
  const aura = span(t, 1.15, 1.8) * (1 - span(t, 5.95, 6.5));
  v += aura * (Math.sin(t * Math.PI * 2 * 73) * 0.14 + Math.sin(t * Math.PI * 2 * 146) * 0.08 + noise * 0.04);
  const charge = span(t, 2.85, 4.15) * (1 - span(t, 4.2, 4.3)), a = Math.max(0, t - 2.85);
  v += charge * (Math.sin(2 * Math.PI * (220 * a + 140 * a * a)) * 0.22 + noise * 0.06);
  const beam = span(t, 4.25, 4.29) * (1 - span(t, 5.65, 5.9));
  v += beam * (noise * 0.28 + Math.sin(2 * Math.PI * t * 90) * 0.19 + Math.sin(2 * Math.PI * t * 285) * 0.12);
  for (const at of [4.45, 4.7, 4.95, 5.2, 5.55]) {
    const a = t - at;
    v += (noise * 0.35 + Math.sin(2 * Math.PI * a * 65) * 0.55) * pulse(a, 15);
  }
  samples[i] = v * Math.min(1, t / 0.004, (duration - t) / 0.05);
  peak = Math.max(peak, Math.abs(samples[i]));
}
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(samples[i] / peak * 0.86 * 32767), 44 + i * 2);
await writeFile('public/assets/audio/super-kame.wav', wav);
console.log(`super-kame.wav: ${duration}s, ${wav.length} bytes`);
