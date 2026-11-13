"""Writes a .webp next to every image the game loads, keeping the originals untouched.

Usage:  python scripts/convert-webp.py            (requires Pillow 9+)

Colour is lossy (quality 90) but the alpha channel is lossless, so the sprite loader finds the
same transparent gaps and the same cut-out as with the PNG. Prints the size of each pair.
"""
from pathlib import Path
import json
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'public'
QUALITY = 90

# Fighter sheets come from the manifests; the rest is listed here.
EXTRA = [
    'assets/stages/arica/morro.png',
    'assets/stages/arica/chinchorro.png',
    'assets/stages/arica/catedral.png',
    'assets/stages/ARENA URBANA NOCTURNA/ARENA URBANA NOCTURNA.jpg',
    'assets/stages/TEMPLO ANTIGUO/TEMPLO ANTIGUO.jpg',
    'assets/stages/AZOTEA DE RASCACIELOS/AZOTEA DE RASCACIELOS.jpg',
    'assets/menu/arica-coast.png',
    'assets/menu/tilin-3d.png',
    'assets/menu/cesar-3d-v2.png',
    'assets/effects/tilin-super-canto.png',
    'assets/effects/cesar-super.png',
]
MANIFESTS = ['assets/characters/tilin/manifest.json', 'assets/characters/cesar/manifest.json']


def sheet_paths(manifest_path: str) -> list[str]:
    """Image files a manifest points to, as paths under public/ (without the leading slash)."""
    manifest = json.loads((ROOT / manifest_path).read_text(encoding='utf-8'))
    base = manifest['assetPath'].lstrip('/')
    paths = []
    for anim, files in manifest['animations'].items():
        for name in files:

            original = name.lstrip('/') if name.startswith('/') else f'{base}{anim}/{name}'
            # Already converted manifests point at .webp: look for the original next to it.
            if name.endswith('.webp'):
                for ext in ('.png', '.jpg', '.JPG'):
                    candidate = Path(original).with_suffix(ext)
                    if (ROOT / candidate).exists():
                        original = candidate.as_posix()
                        break
            paths.append(original)

    return paths


def convert(relative: str) -> tuple[int, int]:
    source = ROOT / relative
    target = source.with_suffix('.webp')
    image = Image.open(source)
    if image.mode not in ('RGB', 'RGBA'):
        image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
    image.save(target, 'WEBP', quality=QUALITY, alpha_quality=100, method=6)
    return source.stat().st_size, target.stat().st_size


def main() -> int:
    files = list(dict.fromkeys(EXTRA + [p for m in MANIFESTS for p in sheet_paths(m)]))
    before = after = 0
    for relative in files:
        if not (ROOT / relative).exists():
            print(f'missing: {relative}', file=sys.stderr)
            return 1
        a, b = convert(relative)
        before += a
        after += b
        print(f'{a / 1e6:7.2f} MB -> {b / 1e6:6.2f} MB  {relative}')
    print(f'\n{len(files)} images: {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB ({after / before:.0%})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
