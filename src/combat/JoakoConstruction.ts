import Phaser from 'phaser';

type Point = [number, number];
const progress = (t: number, a: number, b: number) => Phaser.Math.Clamp((t - a) / (b - a), 0, 1);
const colors = [0xc99962, 0xd6aa70, 0xbd8753, 0xe1b87c];

// One footprint for every face, post, tread and the character's climb.
export const JOAKO_FORT = {
  floor: 585, wallX: 565, stairX: 250, deckLeft: 470, deckRight: 650,
  deckHeight: 180, depthX: 72, depthY: -34, stairRun: 240,
  steps: 10, casterStart: 260, casterX: 560,
} as const;

function polygon(g: Phaser.GameObjects.Graphics, points: Point[], color: number, alpha = 1, outline = 0x493c32): void {
  const vertices = points.map(([x, y]) => ({ x, y }));
  g.fillStyle(color, alpha).fillPoints(vertices, true);
  g.lineStyle(1.5, outline, alpha).strokePoints(vertices, true);
}

function beam(g: Phaser.GameObjects.Graphics, a: Point, b: Point, width: number, alpha: number, color = 0x92613e): void {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = -(b[1] - a[1]) / length * width / 2, ny = (b[0] - a[0]) / length * width / 2;
  polygon(g, [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], color, alpha);
  g.lineStyle(2, 0xf3c991, alpha * 0.65).lineBetween(a[0] + nx, a[1] + ny, b[0] + nx, b[1] + ny);
}

/** Individual boards snap into their blueprint; no tweens or wall-clock timers. */
function board(g: Phaser.GameObjects.Graphics, points: Point[], p: number, index: number, reduced: boolean): void {
  if (p <= 0) return;
  const settle = reduced ? 0 : 1 - Phaser.Math.Easing.Cubic.Out(p);
  const center = points.reduce((a, v) => [a[0] + v[0] / 4, a[1] + v[1] / 4] as Point, [0, 0] as Point);
  const angle = settle * (index % 2 ? -0.16 : 0.16);
  const transformed = points.map(([x, y]): Point => {
    const dx = x - center[0], dy = y - center[1];
    return [center[0] + dx * Math.cos(angle) - dy * Math.sin(angle) + settle * (index % 2 ? 28 : -22),
      center[1] + dx * Math.sin(angle) + dy * Math.cos(angle) - settle * 36];
  });
  const alpha = Math.min(1, p * 4);
  polygon(g, transformed.map(([x, y]) => [x + 3, y + 5]), 0x674933, alpha);
  polygon(g, transformed, colors[index % colors.length], alpha);
  const [a, b, c, d] = transformed;
  g.lineStyle(1.5, 0xffd99c, alpha * 0.8).lineBetween(a[0], a[1], b[0], b[1]);
  // Grain follows each board's long axis, including its assembly rotation.
  for (const q of [0.22, 0.67]) {
    g.lineStyle(1, 0x825533, alpha * 0.55).lineBetween(
      Phaser.Math.Linear(a[0], b[0], q), Phaser.Math.Linear(a[1], b[1], q) + 3,
      Phaser.Math.Linear(d[0], c[0], q), Phaser.Math.Linear(d[1], c[1], q) - 3);
  }
  for (const v of [a, c]) {
    const x = v[0] * 0.85 + center[0] * 0.15, y = v[1] * 0.85 + center[1] * 0.15;
    g.fillStyle(0x3e4045, alpha).fillCircle(x, y, 2);
    g.fillStyle(0xd5c7a4, alpha).fillCircle(x - 0.5, y - 0.6, 0.8);
  }
  if (!reduced && p < 1) {
    const glow = Math.sin(p * Math.PI);
    g.lineStyle(2, 0xb9faff, glow * 0.8).strokePoints(transformed.map(([x, y]) => ({ x, y })), true);
    for (let i = 0; i < 3; i++) {
      const x = center[0] + Math.cos(index * 2 + i * 2.1) * (12 + p * 35);
      const y = center[1] + Math.sin(index * 2 + i * 2.1) * (8 + p * 24);
      g.fillStyle(0xc0f8ff, glow).fillRect(x, y, 2, 4);
    }
  }
}

function blueprint(g: Phaser.GameObjects.Graphics, points: Point[], alpha: number): void {
  if (alpha <= 0) return;
  polygon(g, points, 0x208eef, alpha * 0.16, 0x9aeaff);
  g.lineStyle(5, 0x398dff, alpha * 0.14).strokePoints(points.map(([x, y]) => ({ x, y })), true);
  g.lineStyle(1.5, 0xb3f3ff, alpha).strokePoints(points.map(([x, y]) => ({ x, y })), true);
}

export function drawJoakoConstruction(wall: Phaser.GameObjects.Graphics, stairs: Phaser.GameObjects.Graphics, t: number, reduced: boolean): void {
  const f = JOAKO_FORT, left = f.deckLeft - f.wallX, right = f.deckRight - f.wallX;
  const h = f.deckHeight, dx = f.depthX, dy = f.depthY;
  wall.clear().setVisible(t >= 820);
  stairs.clear().setVisible(t >= 1340);
  const wallPlan = progress(t, 820, 900) * (1 - progress(t, 1360, 1580));
  const frame = progress(t, 900, 1120), braces = progress(t, 1260, 1500);
  // All four feet sit on the same projected ground plane.
  wall.fillStyle(0x14212b, frame * 0.28).fillEllipse((left + right + dx) / 2, dy / 2 + 5, right - left + dx + 42, 52);
  for (const [x, y] of [[left, 0], [right, 0], [left + dx, dy], [right + dx, dy]] as Point[]) {
    polygon(wall, [[x - 12, y], [x + 12, y], [x + 22, y - 5], [x - 2, y - 5]], 0x44484b, frame);
  }
  blueprint(wall, [[left, 0], [left, -h], [right, -h], [right, 0]], wallPlan);
  blueprint(wall, [[right, 0], [right + dx, dy], [right + dx, -h + dy], [right, -h]], wallPlan);
  for (let i = 1; i < 8; i++) wall.lineStyle(1, 0x7fdcff, wallPlan * 0.6).lineBetween(left + i * (right - left) / 8, 0, left + i * (right - left) / 8, -h);
  for (let y = -24; y > -h; y -= 24) wall.lineStyle(1, 0x7fdcff, wallPlan * 0.4).lineBetween(left, y, right, y);
  // Side boards share the deck's depth and ground slope; nothing extends below it.
  for (let i = 0; i < 4; i++) {
    const x = right + i * dx / 4, y = i * dy / 4, w = dx / 4 - 1;
    board(wall, [[x, y - h + 12], [x + w, y + dy / 4 - h + 12], [x + w, y + dy / 4 - 7], [x, y - 7]], progress(t, 940 + i * 44, 1120 + i * 44), i + 2, reduced);
  }
  polygon(wall, [[right, -7], [right + dx, dy - 7], [right + dx, -h + dy + 12], [right, -h + 12]], 0x312d29, frame * 0.24);
  const plankWidth = (right - left - 12) / 8;
  for (let i = 0; i < 8; i++) {
    const x = left + 6 + i * plankWidth;
    board(wall, [[x, -h + 12], [x + plankWidth - 1, -h + 12], [x + plankWidth - 1, -8], [x, -8]], progress(t, 960 + i * 42, 1140 + i * 42), i, reduced);
  }
  for (const x of [left, right]) beam(wall, [x, -4], [x, -h + 8], 14, frame);
  beam(wall, [right + dx, dy - 3], [right + dx, -h + dy + 8], 12, frame, 0x785337);
  for (const y of [-8, -h + 8]) {
    beam(wall, [left - 4, y], [right + 4, y], 14, frame, 0xaa794c);
    beam(wall, [right + 4, y], [right + dx + 4, y + dy], 13, frame, 0x815a3b);
  }
  beam(wall, [left + 12, -22], [right - 12, -h + 23], 11, braces, 0xa47143);
  beam(wall, [left + 12, -h + 23], [right - 12, -22], 10, braces, 0xbc8b55);
  beam(wall, [right + 10, -22], [right + dx - 10, -h + dy + 23], 9, braces, 0x976941);
  // Metal joint plates and bolt heads connect the posts to the floor and top frame.
  for (const y of [-15, -h + 15]) for (const x of [left, right]) {
    wall.fillStyle(0x535961, braces).fillRoundedRect(x - 8, y - 10, 16, 20, 2);
    wall.lineStyle(1, 0xadb2b0, braces).strokeRoundedRect(x - 8, y - 10, 16, 20, 2);
    for (const offset of [-5, 5]) {
      wall.fillStyle(0x222d38, braces).fillCircle(x, y + offset, 2.3);
      wall.fillStyle(0xd0c6ad, braces).fillCircle(x - 0.7, y + offset - 0.6, 0.8);
    }
  }

  const rampPlan = progress(t, 1340, 1420) * (1 - progress(t, 1940, 2140));
  const run = f.stairRun, rise = h / f.steps, step = run / f.steps;
  const deckLeft = f.deckLeft - f.stairX, deckRight = f.deckRight - f.stairX;
  blueprint(stairs, [[0, 0], [run, -h], [run + dx, -h + dy], [dx, dy]], rampPlan);
  blueprint(stairs, [[deckLeft, -h], [deckRight, -h], [deckRight + dx, -h + dy], [deckLeft + dx, -h + dy]], rampPlan);
  for (let i = 0; i <= f.steps; i++) stairs.lineStyle(1, 0x91e7ff, rampPlan * 0.7).lineBetween(i * step, -i * rise, i * step + dx, -i * rise + dy);
  const supports = progress(t, 1430, 1730);
  stairs.fillStyle(0x14212b, supports * 0.22).fillEllipse(run / 2 + dx / 2, dy / 2 + 4, run + dx + 15, 44);
  // Notched side stringers sit UNDER the treads instead of cutting across them.
  const stringer: Point[] = [];
  for (let i = 0; i < f.steps; i++) stringer.push([i * step, -(i + 1) * rise + 6], [(i + 1) * step, -(i + 1) * rise + 6]);
  stringer.push([run, -h + 24], [step, 0], [0, 0]);
  polygon(stairs, stringer.map(([x, y]) => [x + dx, y + dy]), 0x765337, supports);
  for (const x of [run * 0.5, run]) {
    const y = -x / run * h + 10;
    beam(stairs, [x + dx, dy - 3], [x + dx, y + dy], 12, supports, 0x705039);
    beam(stairs, [x, -3], [x, y], 13, supports, 0x986c44);
    beam(stairs, [x, y], [x + dx, y + dy], 11, supports, 0x9b7049);
    beam(stairs, [x - 10, -5], [x + 10, -5], 9, supports, 0x5f5145);
  }
  beam(stairs, [12, -10], [run * 0.5, -h * 0.5 - 6], 10, supports, 0x8b603d);
  beam(stairs, [run * 0.5, -10], [run - 8, -h + 7], 10, supports, 0x8b603d);
  beam(stairs, [run * 0.5, -h * 0.5 - 6], [run - 8, -10], 9, supports, 0x805636);
  for (let i = 0; i < f.steps; i++) {
    const x = i * step, y = -(i + 1) * rise;
    board(stairs, [[x, y], [x + dx, y + dy], [x + step + dx, y + dy], [x + step, y]], progress(t, 1480 + i * 42, 1640 + i * 42), i + 2, reduced);
    beam(stairs, [x, y + 4], [x + step, y + 4], 5, progress(t, 1640 + i * 42, 1710 + i * 42), 0x9b6b40);
  }
  polygon(stairs, stringer, 0xa87947, supports);
  stairs.lineStyle(2, 0xdcb780, supports * 0.7).lineBetween(10, -8, run - 10, -h + 26);
  for (const x of [run * 0.5, run - 8]) {
    const y = -x / run * h + 10;
    stairs.fillStyle(0x4b5055, supports).fillCircle(x, y, 5);
    stairs.fillStyle(0xc3c4b9, supports).fillCircle(x - 0.7, y - 0.7, 2);
  }
  // Five deck boards finish flush with the wall frame and overlap the last tread.
  const deckBoard = (deckRight - deckLeft) / 5;
  for (let i = 0; i < 5; i++) {
    const x = deckLeft + i * deckBoard;
    board(stairs, [[x, -h], [x + dx, -h + dy], [x + dx + deckBoard, -h + dy], [x + deckBoard, -h]], progress(t, 1820 + i * 35, 1980 + i * 35), i + 1, reduced);
  }
  beam(stairs, [deckLeft, -h + 4], [deckRight, -h + 4], 6, progress(t, 1980, 2140), 0xa57748);
}
