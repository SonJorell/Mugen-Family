import { mkdir, writeFile } from 'node:fs/promises';

// Original procedural arcade foley, aligned with the 5.8-second i30 cinematic.
// A single sound lets Phaser pause/resume the engine and every cue with combat time.
const rate = 44100, duration = 5.8, samples = new Float32Array(Math.ceil(rate * duration));
let seed = 9304, low = 0, enginePhase = 0, peak = 0;
const clamp = v => Math.min(1, Math.max(0, v));
const hit = (t, at, strength, frequency) => {
  const age = t - at;
  return age >= 0 && age < 0.7 ? strength * Math.sin(2 * Math.PI * frequency * age * (1 - age * 0.35)) * Math.exp(-age * 12) : 0;
};
for (let i = 0; i < samples.length; i++) {
  const t = i / rate;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const noise = seed / 2147483648 - 1;
  low += 0.085 * (noise - low);
  let sound = hit(t, 0.01, 0.6, 100) + hit(t, 1.45, 0.9, 60) + hit(t, 2.35, 0.6, 135) + hit(t, 3.3, 1.5, 45);
  if (t >= 0.55 && t < 1.45) sound += low * 1.2 * Math.sin((t - 0.55) / 0.9 * Math.PI);
  if (t >= 1.45 && t < 1.8) sound += noise * 0.3 * Math.exp(-(t - 1.45) * 15);
  if (t >= 2.0 && t < 2.35) sound += Math.sin(t * 2 * Math.PI * 48) * Math.sin(t * 2 * Math.PI * 630) * 0.18;
  if (t >= 2.25 && t < 3.95) {
    const speed = clamp((t - 2.6) / 0.7);
    const doppler = t < 3.3 ? 1 : Math.max(0.35, 1 - (t - 3.3) * 1.5);
    enginePhase += 2 * Math.PI * (62 + speed * 185) * doppler / rate;
    const envelope = clamp((t - 2.25) / 0.18) * clamp((3.95 - t) / 0.5);
    const motor = Math.sin(enginePhase) * 0.35 + Math.sin(enginePhase * 2) * 0.25 + Math.sin(enginePhase * 4) * 0.13;
    sound += (Math.tanh(motor * 2) * 0.6 + low * 0.65) * envelope;
    if (t > 2.6) sound += Math.sin(2 * Math.PI * 1800 * t + Math.sin(t * 19) * 9) * 0.07 * envelope;
  }
  if (t >= 3.3 && t < 3.85) sound += (noise * 0.45 + low * 2) * Math.exp(-(t - 3.3) * 8);
  if (t >= 4.45 && t < 5.15) {
    const age = t - 4.45;
    sound += noise * (0.5 * Math.exp(-age * 95) + 0.12 * Math.exp(-age * 6));
    sound += Math.sin(age * Math.PI * 2 * 1250) * Math.exp(-age * 30) * 0.15;
  }
  samples[i] = sound * Math.min(1, t / 0.004, (duration - t) / 0.03);
  peak = Math.max(peak, Math.abs(samples[i]));
}
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(samples[i] / peak * 0.88 * 32767), 44 + i * 2);
await mkdir('public/assets/audio', { recursive: true });
await writeFile('public/assets/audio/super-drive.wav', wav);
console.log(`super-drive.wav: ${duration}s, ${samples.length} samples, ${wav.length} bytes`);
