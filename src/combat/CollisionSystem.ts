// ============================================================
// CollisionSystem — Detects hitbox vs hurtbox collisions
// ============================================================

import { ActiveBox } from './Hitbox';

export function rectsOverlap(a: ActiveBox, b: ActiveBox): boolean {
  return (
    a.worldX < b.worldX + b.width &&
    a.worldX + a.width > b.worldX &&
    a.worldY < b.worldY + b.height &&
    a.worldY + a.height > b.worldY
  );
}
