import math, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from parts import P, PIVOT

SRC = Image.open('cesar_rgba.png')
W, H = SRC.size
S2 = lambda pts: [(x*2, y*2) for x, y in pts]

def mask_of(poly):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(S2(poly), fill=255); return m

src_a = np.array(SRC)
alpha = src_a[..., 3]
parts = {}
taken = np.zeros((H, W), bool)
# Everything below the shorts hem line belongs to a leg (split at the crotch).
hem = Image.new('L', (W, H), 0)
ImageDraw.Draw(hem).polygon(S2([(0,790),(200,800),(355,852),(450,748),(560,768),(705,790),(896,790),(896,1200),(0,1200)]), fill=255)
hem = np.array(hem) > 0
xs_grid = np.arange(W)[None, :].repeat(H, 0)
for name in ['head', 'arm_rear', 'arm_front', 'leg_rear', 'leg_front']:
    mm = mask_of(P[name])
    if name in ('arm_front', 'head'): mm = mm.filter(ImageFilter.MaxFilter(15))
    m = np.array(mm) > 0
    if name == 'leg_rear': m |= hem & (xs_grid < 900)
    if name == 'leg_front': m |= hem & (xs_grid >= 900)
    m &= alpha > 0
    m &= ~taken
    arr = np.zeros_like(src_a); arr[m] = src_a[m]
    if name.startswith('leg'):
        # Duplicate a band of shorts above each leg so lean/rotation never opens a gap.
        side = (xs_grid < 900) if name == 'leg_rear' else (xs_grid >= 900)
        band = np.zeros((H, W), bool)
        sh = hem.copy()
        for k in range(1, 160, 4): band |= np.roll(hem, -k, 0)
        band &= ~hem & side & (alpha > 0) & ~taken
        arr[band] = src_a[band]
    parts[name] = arr; taken |= m

# Torso = remaining pixels; fill the hole left by the rear forearm (it lies over the shirt).
torso = src_a.copy(); torso[taken] = 0
hole = (np.array(mask_of(P['arm_rear'])) > 0) & (alpha > 0)
# Keep only the hole area that is inside the torso silhouette (not the elbow sticking out).
inside = hole.copy()
ys, xs = np.where(hole)
filled = torso.copy()
shirt = src_a[880:920, 840:880, :3].reshape(-1, 3)
col = np.median(shirt, 0).astype(np.uint8)
fill = hole & (alpha > 0)
fill[:, :470] = False
filled[fill, :3] = col; filled[fill, 3] = 255
# Skin stubs where the forearms leave the sleeves, so a moved forearm leaves an upper arm behind.
skin = np.median(src_a[880:900, 1300:1330, :3].reshape(-1, 3), 0).astype(np.uint8)
for name, cond in (('arm_front', lambda X, Y: (X < 1350) & (Y > 760)), ('arm_rear', lambda X, Y: (X < 520) & (Y > 800))):
    m = (np.array(mask_of(P[name])) > 0) & (alpha > 0)
    Y, X = np.mgrid[0:H, 0:W]
    stub = m & cond(X, Y)
    filled[stub] = src_a[stub]
parts['torso'] = filled

PIV = {k: (x*2, y*2) for k, (x, y) in PIVOT.items()}
PIV['torso'] = (900, 1600)

class Part:
    def __init__(self, arr, pivot):
        im = Image.fromarray(arr, 'RGBA'); bbox = im.getbbox()
        self.im = im.crop(bbox); self.px = pivot[0] - bbox[0]; self.py = pivot[1] - bbox[1]
    def render(self, canvas, wx, wy, angle=0.0, sx=1.0, sy=1.0, flip=False):
        im = self.im; px, py = self.px, self.py
        if sx != 1 or sy != 1:
            im = im.resize((max(1, int(im.width*sx)), max(1, int(im.height*sy))), Image.NEAREST); px *= sx; py *= sy
        r = int(math.hypot(max(px, im.width-px), max(py, im.height-py))) + 2
        pad = Image.new('RGBA', (2*r, 2*r)); pad.paste(im, (int(r-px), int(r-py)))
        if angle: pad = pad.rotate(-angle, resample=Image.NEAREST, center=(r, r))  # +angle = clockwise
        canvas.alpha_composite(pad, (int(wx - r), int(wy - r))) if 0 <= int(wx-r) and 0 <= int(wy-r) else paste_clip(canvas, pad, int(wx-r), int(wy-r))

def paste_clip(canvas, im, x, y):
    cx0, cy0 = max(0, -x), max(0, -y)
    im = im.crop((cx0, cy0, im.width, im.height)); canvas.alpha_composite(im, (x+cx0, y+cy0))

import os
if os.path.exists(os.path.join(os.path.dirname(__file__), 'parts_clean.npz')):
    parts = dict(np.load(os.path.join(os.path.dirname(__file__), 'parts_clean.npz')))
PARTS = {k: Part(v, PIV[k]) for k, v in parts.items()}

def rot(p, c, deg):
    a = math.radians(deg); x, y = p[0]-c[0], p[1]-c[1]
    return (c[0] + x*math.cos(a) - y*math.sin(a), c[1] + x*math.sin(a) + y*math.cos(a))

DEFAULT = dict(_air=False, spin=False, dx=0, dy=0, lean=0, head=0, ar=0, af=0, ar_dx=0, ar_dy=0, af_dx=0, af_dy=0,
               lr=0, lf=0, lr_sy=1, lf_sy=1, lr_dx=0, lf_dx=0, body_sy=1, whole=0, front_arm_on_top=True, sy_all=1)

def pose_image(**kw):
    p = {**DEFAULT, **kw}
    c = Image.new('RGBA', (W + 5000, H + 2600)); OX, OY = 2500, 1300  # room for full-body rotations
    hip = PIV['torso']; root = (hip[0] + p['dx'] + OX, hip[1] + p['dy'] + OY)
    def at(pt):  # source point on torso -> world after lean
        rel = (pt[0] - hip[0], (pt[1] - hip[1]) * p['body_sy'])
        return rot((root[0] + rel[0], root[1] + rel[1]), root, p['lean'])
    for leg, ang, sy, ldx in (('leg_rear', p['lr'], p['lr_sy'], p['lr_dx']), ('leg_front', p['lf'], p['lf_sy'], p['lf_dx'])):
        lp = PIV[leg]; w = (lp[0] - hip[0] + root[0] + ldx, lp[1] - hip[1] + root[1] + (1 - p['body_sy']) * 0)
        PARTS[leg].render(c, w[0], w[1], ang, 1, sy)
    order = ['torso', 'head', 'arm_front', 'arm_rear'] if p['front_arm_on_top'] else ['arm_front', 'torso', 'head', 'arm_rear']
    for name in order:
        if name == 'torso':
            PARTS['torso'].render(c, root[0], root[1], p['lean'], 1, p['body_sy'])
        elif name == 'head':
            w = at(PIV['head']); PARTS['head'].render(c, w[0], w[1], p['lean'] + p['head'])
        else:
            key = 'ar' if name == 'arm_rear' else 'af'
            w = at(PIV[name]); PARTS[name].render(c, w[0] + p[key+'_dx'], w[1] + p[key+'_dy'], p['lean'] + p[key])
    # Ground contact: shift so the requested ground line stays put when legs are compressed.
    if p['whole']:
        bbox = c.getbbox()
        if p.get('spin'): center = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
        else: center = (hip[0] + OX, bbox[3])
        c = c.rotate(-p['whole'], resample=Image.NEAREST, center=center)
    return c, (OX, OY)
