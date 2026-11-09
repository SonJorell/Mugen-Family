import { mkdir, writeFile } from 'node:fs/promises';

// Original arcade compositions and a synthetic vowel, with no third-party recordings.
const rate = 22050;
await mkdir('public/assets/audio', { recursive: true });
function note(buffer, start, duration, midi, gain, instrument = 'lead') {
  const first = Math.round(start * rate), length = Math.floor(duration * rate);
  const hz = 440 * 2 ** ((midi - 69) / 12);
  for (let i = 0; i < length && first + i < buffer.length; i++) {
    const t = i / rate, phase = 2 * Math.PI * hz * t;
    const envelope = Math.min(1, t / (instrument === 'pad' ? 0.12 : 0.008)) * Math.min(1, (duration - t) / 0.08);
    const wave = instrument === 'bass' ? Math.sin(phase) + Math.sin(phase * 2) * 0.2
      : instrument === 'pad' ? Math.sin(phase) * 0.75 + Math.sin(phase * 1.003) * 0.25
      : (Math.sin(phase) + Math.sin(phase * 2) * 0.28 + Math.sin(phase * 3) * 0.12) * Math.exp(-t * 4);
    buffer[first + i] += wave * envelope * gain;
  }
}
function drum(buffer, start, type, gain) {
  let seed = 739391;
  const duration = type === 'hat' ? 0.065 : 0.22;
  const first = Math.round(start * rate);
  for (let i = 0; i < duration * rate && first + i < buffer.length; i++) {
    const t = i / rate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    const kick = Math.sin(2 * Math.PI * (48 * t + 75 * (1 - Math.exp(-t * 35)) / 35)) * Math.exp(-t * 24);
    const sample = type === 'kick' ? kick : type === 'snare'
      ? (noise * 0.65 + Math.sin(t * 2 * Math.PI * 180) * 0.25) * Math.exp(-t * 28)
      : noise * Math.exp(-t * 80);
    buffer[first + i] += sample * gain * Math.min(1, t / 0.001);
  }
}
async function save(name, buffer) {
  let peak = 0;
  for (const n of buffer) peak = Math.max(peak, Math.abs(n));
  const wav = Buffer.alloc(44 + buffer.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(buffer.length * 2, 40);
  for (let i = 0; i < buffer.length; i++) wav.writeInt16LE(Math.round(buffer[i] / peak * 0.82 * 32767), 44 + i * 2);
  await writeFile(`public/assets/audio/${name}.wav`, wav);
  console.log(`${name}: ${(buffer.length / rate).toFixed(2)} s, peak normalized to -1.7 dBFS`);
}
for (const combat of [false, true]) {
  const beat = 60 / (combat ? 128 : 96), bars = combat ? 16 : 8;
  const buffer = new Float32Array(Math.round(bars * 4 * beat * rate));
  const chords = [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]];
  const melody = [76, 79, 78, 74, 76, 71, 74, 78, 79, 83, 81, 78, 76, 74, 71, 74];
  for (let bar = 0; bar < bars; bar++) {
    const chord = chords[bar % 4], start = bar * 4 * beat;
    chord.forEach(n => note(buffer, start, beat * 3.95, n + 12, 0.095, 'pad'));
    for (let b = 0; b < 4; b++) {
      note(buffer, start + b * beat, beat * 0.7, chord[0] - 12, 0.32, 'bass');
      drum(buffer, start + b * beat, b % 2 === 0 ? 'kick' : 'snare', combat ? 0.45 : 0.27);
      for (let h = 0; h < 2; h++) drum(buffer, start + (b + h / 2) * beat, 'hat', h ? 0.1 : 0.055);
      note(buffer, start + b * beat, beat * 0.8, melody[(bar * 4 + b) % melody.length], combat ? 0.16 : 0.12);
    }
    for (let step = 0; step < (combat ? 16 : 8); step++) {
      const spacing = combat ? 0.25 : 0.5;
      note(buffer, start + step * spacing * beat, beat * spacing * 0.85,
        chord[step % 3] + 24, combat ? 0.075 : 0.055);
    }
  }
  await save(combat ? 'music-fight' : 'music-menu', buffer);
}
// A short pitched 'ah' with moving vowel formants and vibrato for the sonic release.
const voice = new Float32Array(Math.round(rate * 0.58));
let phase = 0;
for (let i = 0; i < voice.length; i++) {
  const t = i / rate, hz = 370 + 85 * Math.min(1, t / 0.12) + Math.sin(t * Math.PI * 12) * 6;
  phase += 2 * Math.PI * hz / rate;
  let sample = 0;
  for (let h = 1; h <= 24; h++) {
    const f = h * hz;
    const formant = Math.exp(-(((f - 800) / 250) ** 2)) + 0.7 * Math.exp(-(((f - 1200) / 190) ** 2)) + 0.35 * Math.exp(-(((f - 2800) / 350) ** 2));
    sample += Math.sin(phase * h) * (0.1 / h + formant / Math.sqrt(h));
  }
  voice[i] = Math.tanh(sample) * Math.min(1, t / 0.035) * Math.min(1, (0.58 - t) / 0.14);
}
await save('voice-canto', voice);
