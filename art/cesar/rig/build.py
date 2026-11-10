import math, sys, os, json
import numpy as np
from PIL import Image
import rig
from anims import ANIMS, AIRBORNE, LYING
K = 0.2; CW, CH = 640, 560; GROUND = 530; COLS, ROWS = 4, 3
FW, FH, FG = int(CW / K), int(CH / K), int(GROUND / K)
HIP_X, HIP_Y = 900, 1600; HIP_H = 2369 - HIP_Y
out_dir = sys.argv[1]; only = sys.argv[2:] or list(ANIMS)

def frame(p):
    img, (OX, OY) = rig.pose_image(**p)
    bbox = img.getbbox()
    hx = HIP_X + OX
    cell = Image.new('RGBA', (FW, FH))
    w = abs(p.get('whole', 0))
    if p.get('_air'):
        x = FW / 2 - hx; y = (FG - HIP_H) - (HIP_Y + OY)
    else:
        shift = 1000 * math.sin(math.radians(min(w, 90))) if w and not p.get('spin') else 0
        x = FW / 2 - hx + shift; y = FG - bbox[3]
    cell.alpha_composite(img, (0, 0), (0, 0)) if False else None
    cell.paste(img, (int(x), int(y)), img)
    small = cell.resize((CW, CH), Image.BOX)
    a = np.array(small); a[..., 3] = np.where(a[..., 3] > 110, 255, 0)
    a[:6] = 0; a[-6:] = 0; a[:, :6] = 0; a[:, -6:] = 0
    return Image.fromarray(a, 'RGBA')

for name in only:
    poses = ANIMS[name]
    sheet = Image.new('RGBA', (CW * COLS, CH * ROWS))
    for i, p in enumerate(poses):
        p = dict(p)
        if name in AIRBORNE: p['_air'] = True
        f = frame({k: v for k, v in p.items()} if True else p)
        sheet.paste(f, ((i % COLS) * CW, (i // COLS) * CH))
    os.makedirs(f'{out_dir}/{name}', exist_ok=True)
    sheet.save(f'{out_dir}/{name}/{name}.png', optimize=True)
    print(name, flush=True)
