# Uso: python scripts/clean-sheet-bleed.py . <luchador> <carpeta-respaldo> [--apply]
# Sin --apply solo informa qué se borraría.
"""Erase strips bled in from the neighbouring frame at the top of each cell of a fighter's sheets.

A strip is removed only when it is separated from the character by fully transparent rows:
scan down from the top edge of the cell; if opaque pixels start at the edge and a transparent
row appears within MAX_BAND rows, everything above that row is cleared. Cells whose content
touches the top edge without such a gap (a raised arm, a jump) are left alone.
"""
import json, os, shutil, sys
from PIL import Image

root, char, backup = sys.argv[1], sys.argv[2], sys.argv[3]
apply = '--apply' in sys.argv
MAX_BAND, ALPHA = 40, 8
m = json.load(open(f'{root}/public/assets/characters/{char}/manifest.json', encoding='utf-8'))
sheet = m['spriteSheet']
for name, files in m['animations'].items():
    cfg = {**sheet, **sheet.get('animations', {}).get(name, {})}
    cols, rows, count = cfg['columns'], cfg['rows'], cfg['frameCount']
    path = root + '/public' + files[0]
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    fw, fh = W / cols, H / rows
    px = im.load()
    cleared = []
    for i in range(count):
        cx, cy = i % cols, i // cols
        x0, x1 = round(cx * fw), round((cx + 1) * fw)
        y0, y1 = round(cy * fh), round((cy + 1) * fh)
        def opaque(edge, k):
            if edge in ('top', 'bottom'):
                y = y0 + k if edge == 'top' else y1 - 1 - k
                return any(px[x, y][3] > ALPHA for x in range(x0, x1))
            x = x0 + k if edge == 'left' else x1 - 1 - k
            return any(px[x, y][3] > ALPHA for y in range(y0, y1))
        for edge in ('top', 'left', 'right'):
            span = (y1 - y0) if edge == 'top' else (x1 - x0)
            if not opaque(edge, 0):
                continue
            gap = next((k for k in range(min(MAX_BAND, span)) if not opaque(edge, k)), None)
            if gap is None:
                continue
            for k in range(gap):
                if edge == 'top':
                    for x in range(x0, x1): px[x, y0 + k] = (0, 0, 0, 0)
                else:
                    x = x0 + k if edge == 'left' else x1 - 1 - k
                    for y in range(y0, y1): px[x, y] = (0, 0, 0, 0)
            cleared.append(f'f{i}:{edge}{gap}px')
    if cleared:
        print(f'{name:15} cleared ' + ' '.join(cleared))
        if apply:
            os.makedirs(backup, exist_ok=True)
            dst = os.path.join(backup, os.path.basename(path))
            if not os.path.exists(dst):
                shutil.copy2(path, dst)
            im.save(path, 'WEBP', quality=92, method=6, exact=True)
