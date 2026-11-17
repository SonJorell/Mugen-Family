"""Announcer lines in the voice «koku» with the «Deep Voice» preset, made with Voicebox running locally.

For each line: a few dry takes, each transcribed with Voicebox's Whisper and scored against the
expected words; the best take gets the Deep Voice effects chain (pitch −3 st, low-pass 6 kHz,
compressor), then silence is trimmed and the peak normalised to −1 dBFS.
  python scripts/generate-announcer-koku.py [takes] [line ...]  → public/assets/audio/announcer-*.wav
Needs Voicebox open (API on 127.0.0.1:17493) with the «koku» profile. «K.O.» is read as «¡Nocaut!»:
the model never pronounced the letters clearly.
"""
import json, sys, time, urllib.request, os, uuid, difflib, unicodedata, re, wave, array

API = 'http://127.0.0.1:17493'
PROFILE = 'koku'
DEEP = [
    {"type": "pitch_shift", "enabled": True, "params": {"semitones": -3.0}},
    {"type": "lowpass", "enabled": True, "params": {"cutoff_frequency_hz": 6000.0}},
    {"type": "compressor", "enabled": True, "params": {"threshold_db": -18.0, "ratio": 3.0, "attack_ms": 10.0, "release_ms": 150.0}},
]
# line -> (texts to try in turn, words the take must sound like)
LINES = {
    'round-1': (['¡Round uno!', '¡Raund uno!'], 'round uno'),
    'round-2': (['¡Round dos!', '¡Raund dos!'], 'round dos'),
    'round-3': (['¡Round tres!', '¡Raund tres!'], 'round tres'),
    'round-4': (['¡Round cuatro!', '¡Raund cuatro!'], 'round cuatro'),
    'round-5': (['¡Round cinco!', '¡Raund cinco!'], 'round cinco'),
    'fight': (['¡Pelea!'], 'pelea'),
    'ko': (['¡Nocaut!'], 'nocaut'),
    'time': (['¡Tiempo!'], 'tiempo'),
    'victory': (['¡Victoria!'], 'victoria'),
    'defeat': (['Derrota.', '¡Derrota!'], 'derrota'),
    'draw': (['¡Empate!'], 'empate'),
    'p1-wins': (['¡Gana el jugador uno!', '¡Gana jugador uno!'], 'gana el jugador uno'),
    'p2-wins': (['¡Gana el jugador dos!', '¡Gana jugador dos!'], 'gana el jugador dos'),
}
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'audio')


def req(method, path, body=None, headers=None):
    r = urllib.request.Request(API + path, data=body, method=method, headers=headers or {})
    with urllib.request.urlopen(r, timeout=600) as resp:
        raw = resp.read()
        return json.loads(raw) if resp.headers.get_content_type() == 'application/json' else raw


def jcall(method, path, obj=None):
    return req(method, path, json.dumps(obj).encode() if obj is not None else None, {'Content-Type': 'application/json'})


def transcribe(audio):
    b = uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="language"\r\n\r\nes\r\n'
            f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\n').encode() + audio + f'\r\n--{b}--\r\n'.encode()
    return req('POST', '/transcribe', body, {'Content-Type': f'multipart/form-data; boundary={b}'})['text']


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.replace('1', 'uno').replace('2', 'dos').replace('3', 'tres').replace('4', 'cuatro').replace('5', 'cinco')
    return re.sub(r'[^a-z]', '', s)


def wait(gid, effects):
    for _ in range(300):
        h = jcall('GET', f'/history/{gid}')
        if h['status'] == 'failed': return None
        if h['status'] == 'completed' and (not effects or str(h['audio_path']).endswith('_processed.wav')): return h
        time.sleep(1)


def finish(wav_bytes, path):
    """Trims silence at both ends, normalises the peak to −1 dBFS and adds 8 ms fades."""
    import io
    w = wave.open(io.BytesIO(wav_bytes)); sr = w.getframerate(); a = array.array('h', w.readframes(w.getnframes()))
    peak = max(abs(x) for x in a) or 1; win = sr // 100
    env = [max(abs(x) for x in a[i:i + win]) for i in range(0, len(a), win)]
    loud = [i for i, e in enumerate(env) if e > peak * 0.04]
    b = a[max(0, (loud[0] - 6) * win):min(len(a), (loud[-1] + 9) * win)]
    gain, fade = 0.89 * 32767 / peak, int(sr * 0.008)
    out = array.array('h', [int(x * gain * min(1, i / fade, (len(b) - 1 - i) / fade)) for i, x in enumerate(b)])
    # Clips last at least 0.9 s (tests/announcer.spec.ts): short words get trailing silence.
    out.extend([0] * max(0, int(sr * 0.9) - len(out)))
    o = wave.open(path, 'wb'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes(out.tobytes()); o.close()


KOKU = next(p['id'] for p in jcall('GET', '/profiles') if p['name'].lower() == PROFILE)
takes = int(sys.argv[1]) if len(sys.argv) > 1 else 4
for name in sys.argv[2:] or list(LINES):
    texts, expected = LINES[name]
    best = None
    for i in range(takes):
        text = texts[i % len(texts)]
        g = jcall('POST', '/generate', {"profile_id": KOKU, "text": text, "language": "es", "engine": "qwen"})
        h = wait(g['id'], False)
        if not h: continue
        heard = transcribe(req('GET', f"/audio/{g['id']}"))
        score = difflib.SequenceMatcher(None, norm(heard), norm(expected)).ratio()
        print(f'  {name} take {i} {text!r} heard {heard!r} score {score:.2f} dur {h["duration"]}', flush=True)
        # Near-equal scores go to the shorter take: long ones tend to carry stray sounds at the end.
        if not best or round(score, 1) > round(best[0], 1) or (round(score, 1) == round(best[0], 1) and h['duration'] < best[2]):
            best = (score, g['id'], h['duration'], heard)
        if score >= 0.95 and i >= 1: break
    gid = best[1]
    jcall('POST', f'/generations/{gid}/versions/apply-effects', {"effects_chain": DEEP})
    hist = None
    for _ in range(120):
        items = jcall('GET', '/history?limit=50')['items']
        hist = next((x for x in items if x['id'] == gid), None)
        ver = next((v for v in (hist or {}).get('versions') or [] if v.get('effects_chain')), None)
        if ver: break
        time.sleep(1)
    audio = req('GET', f"/audio/version/{ver['id']}")
    finish(audio, os.path.join(OUT, f'announcer-{name}.wav'))
    print(f'{name}: best {best[0]:.2f} heard {best[3]!r} gen {gid}', flush=True)
