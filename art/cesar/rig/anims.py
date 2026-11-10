import math
N = 12
def kf(*keys):
    """keys: (frame, dict). Linear interpolation with smoothstep, returns 12 dicts."""
    keys = sorted(keys, key=lambda k: k[0]); out = []
    for f in range(N):
        a = max([k for k in keys if k[0] <= f], key=lambda k: k[0], default=keys[0])
        b = min([k for k in keys if k[0] >= f], key=lambda k: k[0], default=keys[-1])
        t = 0 if b[0] == a[0] else (f - a[0]) / (b[0] - a[0]); t = t*t*(3-2*t)
        names = set(a[1]) | set(b[1]); d = {}
        for n in names:
            va, vb = a[1].get(n, 0 if n not in ('lr_sy','lf_sy','body_sy') else 1), b[1].get(n, 0 if n not in ('lr_sy','lf_sy','body_sy') else 1)
            d[n] = va + (vb - va) * t if isinstance(va, (int, float)) and not isinstance(va, bool) else (va if t < .5 else vb)
        out.append(d)
    return out

def loop(fn):
    return [fn(2 * math.pi * f / N) for f in range(N)]

GUARD = {}
ANIMS = {}
ANIMS['IDLE'] = loop(lambda t: dict(dy=6 + 6*math.sin(t), body_sy=0.99 + 0.01*math.cos(t), head=1.5*math.sin(t), ar=3*math.sin(t), af=-3*math.sin(t+0.6), af_dy=4*math.sin(t+0.6)))
ANIMS['WALK_FORWARD'] = loop(lambda t: dict(lr=13*math.sin(t), lf=-13*math.sin(t), lean=3 + 2.5*math.sin(t), dy=-12*abs(math.sin(t)) + 6, head=-2*math.sin(t), ar=5*math.sin(t), af=-5*math.sin(t)))
ANIMS['WALK_BACKWARD'] = loop(lambda t: dict(lr=-11*math.sin(t), lf=11*math.sin(t), lean=-4 + 2*math.sin(t), dy=-10*abs(math.sin(t)) + 6, head=-3, ar=-4*math.sin(t), af=4*math.sin(t)))
ANIMS['DASH'] = kf((0, {}), (2, dict(lean=-6, dy=20, lr=8, lf=-6)), (5, dict(lean=18, dx=70, lr=-22, lf=22, ar=20, ar_dx=120, af=-15, head=6)),
                   (8, dict(lean=14, dx=60, lr=-12, lf=12, ar=10, ar_dx=60)), (11, dict(lean=3)))
ANIMS['CROUCH'] = kf((0, {}), (4, dict(lr_sy=0.58, lf_sy=0.58, lr=14, lf=-18, lean=10, body_sy=0.92, ar=10, af=10, af_dy=40)), (11, dict(lr_sy=0.56, lf_sy=0.56, lr=14, lf=-18, lean=11, body_sy=0.91, ar=10, af=10, af_dy=40)))
ANIMS['JUMP'] = kf((0, dict(lr_sy=0.8, lf_sy=0.8, lean=6, body_sy=0.96)), (3, dict(lr=-6, lf=6, lean=-2, ar=-20, af=-15, af_dy=-60)),
                   (6, dict(lr=-30, lf=35, lr_sy=0.85, lf_sy=0.85, lean=4, ar=-10, af=-10)), (9, dict(lr=-20, lf=25, lean=2)), (11, dict(lr=-6, lf=8)))
ANIMS['LIGHT_PUNCH'] = kf((0, {}), (2, dict(lean=-3, af=-8, af_dx=-30)), (4, dict(lean=7, af=56, af_dx=170, af_dy=-120, head=3)), (6, dict(lean=7, af=56, af_dx=180, af_dy=-120, head=3)), (9, dict(lean=2, af=10, af_dx=30)), (11, {}))
ANIMS['HEAVY_PUNCH'] = kf((0, {}), (3, dict(lean=-10, ar=-25, ar_dx=-90, dx=-20, head=-4, lr=6, lf=-4)), (5, dict(lean=16, ar=36, ar_dx=470, ar_dy=-150, dx=40, head=8, lr=-14, lf=12, af=20, af_dx=-60)),
                         (7, dict(lean=17, ar=36, ar_dx=480, ar_dy=-150, dx=45, head=8, lr=-14, lf=12, af=20, af_dx=-60)), (10, dict(lean=6, ar=12, ar_dx=150, dx=20)), (11, dict(lean=2)))
ANIMS['LIGHT_KICK'] = kf((0, {}), (2, dict(lean=-4, lf=-10)), (4, dict(lean=-9, lf=-52, lf_dx=40, ar=-8, af=-10, af_dx=-40)), (6, dict(lean=-9, lf=-54, lf_dx=40, ar=-8, af=-10, af_dx=-40)), (9, dict(lean=-3, lf=-15)), (11, {}))
ANIMS['HEAVY_KICK'] = kf((0, {}), (3, dict(lean=-8, lf=-30, lr=6, dy=8)), (5, dict(lean=-16, lf=-85, lf_dx=80, lr=10, ar=-25, af=-25, af_dx=-80, head=-6)),
                         (7, dict(lean=-16, lf=-88, lf_dx=90, lr=10, ar=-25, af=-25, af_dx=-80, head=-6)), (10, dict(lean=-4, lf=-20)), (11, {}))
ANIMS['BLOCK'] = kf((0, {}), (3, dict(lean=-5, ar=-12, ar_dx=330, ar_dy=-150, af=-20, af_dx=-40, af_dy=-60, head=-6, body_sy=0.97, dx=-10)), (11, dict(lean=-5, ar=-12, ar_dx=330, ar_dy=-150, af=-20, af_dx=-40, af_dy=-60, head=-6, body_sy=0.97, dx=-10)))
ANIMS['HIT_REACTION'] = kf((0, {}), (2, dict(lean=-16, head=-14, dx=-60, ar=-25, af=30, af_dx=-60, lr=-6, lf=10)), (5, dict(lean=-12, head=-10, dx=-50, ar=-15, af=20, lf=6)), (11, {}))
ANIMS['STUN'] = loop(lambda t: dict(lean=-4 + 7*math.sin(t), head=12*math.sin(t + 0.8), ar=40 + 6*math.sin(t), ar_dx=-60, ar_dy=150, af=55 + 6*math.cos(t), af_dy=140, af_dx=-60, dy=8, lr=4*math.sin(t), lf=-4*math.sin(t)))
ANIMS['KNOCKDOWN'] = kf((0, dict(lean=-10, head=-10)), (3, dict(whole=-30, lean=-14, head=-12, ar=-30, af=-40, lf=-25)), (6, dict(whole=-70, head=-8, ar=-40, af=-50, lf=-35, lr=-10)),
                        (8, dict(whole=-92, head=4, ar=-10, af=-20, lf=6, lr=4, body_sy=0.95)), (9, dict(whole=-88, head=0, lf=-4, ar=-20)), (11, dict(whole=-92, head=2, lf=8, lr=4)))
ANIMS['GET_UP'] = kf((0, dict(whole=-92, head=2, lf=8, lr=4)), (3, dict(whole=-62, lean=10, ar=30, af=20, lf=-30, lr=-20)), (6, dict(whole=-30, lean=14, lr_sy=0.8, lf_sy=0.8, lf=-15)), (9, dict(lean=6, lr_sy=0.85, lf_sy=0.85)), (11, {}))
ANIMS['DEFEAT'] = kf((0, dict(lean=-8, head=-12)), (3, dict(whole=-25, lean=-14, head=-16, ar=-35, af=-35)), (6, dict(whole=-75, head=-6, ar=-50, af=-50, lf=-30)), (8, dict(whole=-92, ar=-20, af=-30, lf=6, lr=4)), (11, dict(whole=-92, ar=-10, af=-25, lf=8, lr=4, head=6)))
ANIMS['VICTORY'] = loop(lambda t: dict(af=-30 + 6*math.sin(t), af_dx=40, af_dy=-260 + 25*math.sin(t), ar=-60 + 6*math.sin(t), ar_dx=-60, ar_dy=-330 + 20*math.sin(t), head=-8 + 3*math.sin(2*t), dy=-14*abs(math.sin(t)) + 8, lean=-3))
ANIMS['TAUNT'] = loop(lambda t: dict(ar=25 + 15*math.sin(2*t), ar_dx=60, ar_dy=260 + 30*math.sin(2*t), head=-6 + 6*math.sin(2*t), lean=-6 + 3*math.sin(2*t), body_sy=1 + 0.015*math.sin(2*t), af=-20 + 25*math.sin(t), af_dy=-40))
ANIMS['SPECIAL_ATTACK'] = kf((0, {}), (3, dict(lean=-10, lf=-55, lf_dx=40, ar=-30, ar_dy=-80, af=-40, af_dy=-120, head=-6)), (5, dict(lean=-12, lf=-62, lf_dx=40, ar=-35, ar_dy=-100, af=-45, af_dy=-140, head=-8, dy=-10)),
                             (7, dict(lean=10, lf=4, lf_dx=60, dy=40, body_sy=0.9, lr_sy=0.82, lf_sy=0.84, ar=30, af=40, af_dy=80, head=8)), (9, dict(lean=8, dy=34, body_sy=0.92, lr_sy=0.84, lf_sy=0.86, ar=25, af=35, af_dy=70, head=6)), (11, dict(lean=2, dy=8)))
ANIMS['AIR_PUNCH'] = kf((0, dict(lr=-20, lf=25)), (3, dict(lr=-25, lf=30, lean=10, af=60, af_dx=200, af_dy=-60)), (7, dict(lr=-25, lf=30, lean=10, af=62, af_dx=210, af_dy=-60)), (11, dict(lr=-18, lf=20)))
ANIMS['AIR_KICK'] = kf((0, dict(lr=-20, lf=25)), (3, dict(lr=-30, lf=-75, lf_dx=60, lean=-14, ar=-20, af=-20)), (7, dict(lr=-30, lf=-78, lf_dx=60, lean=-14, ar=-20, af=-20)), (11, dict(lr=-18, lf=10)))
ANIMS['DOUBLE_JUMP'] = [dict(spin=True, whole=30*f, lr=-35, lf=40, lr_sy=0.85, lf_sy=0.85, ar=20, af=30, af_dy=60, lean=10) for f in range(N)]
ANIMS['LANDING'] = kf((0, dict(lr_sy=0.78, lf_sy=0.78, body_sy=0.9, lean=8, dy=30, ar=15, af=15, af_dy=50)), (4, dict(lr_sy=0.82, lf_sy=0.82, body_sy=0.94, lean=6, dy=20)), (11, {}))

AIRBORNE = {'JUMP', 'AIR_PUNCH', 'AIR_KICK', 'DOUBLE_JUMP'}
LYING = {'KNOCKDOWN', 'GET_UP', 'DEFEAT'}
assert all(len(v) == 12 for v in ANIMS.values()), [k for k, v in ANIMS.items() if len(v) != 12]
print(len(ANIMS))
