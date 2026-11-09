import { mkdir, writeFile } from 'node:fs/promises';

// Original three-second vocal crescendo, pressure pulses and final low-frequency impact.
const rate = 22050, length = rate * 3;
const samples = new Float32Array(length);
const beats = [0, 0.9, 1.2, 1.5, 1.8, 2.1, 2.6];
let phase = 0, seed = 92317;
for (let i = 0; i < length; i++) {
  const t = i / rate;
  const note = t < 0.8 ? 64 : t < 1.2 ? 67 : t < 1.8 ? 69 : t < 2.6 ? 71 : 76;
  const frequency = 440 * 2 ** ((note - 69) / 12) * (1 + Math.sin(t * 36) * 0.008);
  phase += Math.PI * 2 * frequency / rate;
  let vowel = 0;
  for (let h = 1; h <= 18; h++) {
    const hz = h * frequency;
    const formant = Math.exp(-(((hz - 820) / 270) ** 2)) + 0.7 * Math.exp(-(((hz - 1250) / 210) ** 2));
    vowel += Math.sin(phase * h) * (0.08 / h + formant / Math.sqrt(h));
  }
  const choir = Math.sin(phase * 1.002) * 0.18 + Math.sin(phase * 1.5) * 0.1;
  let impact = 0;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const noise = seed / 2147483648 - 1;
  for (const beat of beats) {
    const age = t - beat;
    if (age >= 0 && age < 0.4) {
      impact += (Math.sin(age * 2 * Math.PI * (beat === 2.6 ? 55 : 110)) * 0.8 + noise * 0.3)
        * Math.exp(-age * (beat === 2.6 ? 9 : 25)) * Math.min(1, age / 0.003);
    }
  }
  const envelope = Math.min(1, t / 0.04) * Math.min(1, (3 - t) / 0.18);
  samples[i] = ((Math.tanh(vowel) * 0.6 + choir) * (0.5 + Math.min(t / 3, 0.5)) + impact) * envelope;
}
let peak = 0;
for (const value of samples) peak = Math.max(peak, Math.abs(value));
const wav = Buffer.alloc(44 + length * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(length * 2, 40);
for (let i = 0; i < length; i++) wav.writeInt16LE(Math.round(samples[i] / peak * 0.82 * 32767), 44 + i * 2);
await mkdir('public/assets/audio', { recursive: true });
await writeFile('public/assets/audio/super-canto.wav', wav);
console.log('super-canto.wav: 3.00 seconds, original synthesized vocal crescendo, normalized without clipping.');
