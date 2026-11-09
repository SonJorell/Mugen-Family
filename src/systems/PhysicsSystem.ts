import type { Fighter } from '../characters/Fighter';
import { GAME_CONFIG } from '../config/gameConfig';

/** Keep bodies separate while allowing a jump over the opponent. */
export class PhysicsSystem {
  resolve(a: Fighter, b: Fighter): void {
    const left = a.x <= b.x ? a : b;
    const right = left === a ? b : a;
    const distance = right.x - left.x;
    const minDistance = Math.abs(a.y - b.y) < 180 ? 90 : 0;
    const maxDistance = GAME_CONFIG.WIDTH - 200;
    const desired = Math.max(minDistance, Math.min(distance, maxDistance));
    const correction = (desired - distance) / 2;
    left.x -= correction;
    right.x += correction;
    if (left.x < 40) {
      right.x += 40 - left.x;
      left.x = 40;
    }
    if (right.x > GAME_CONFIG.STAGE_WIDTH - 40) {
      left.x -= right.x - (GAME_CONFIG.STAGE_WIDTH - 40);
      right.x = GAME_CONFIG.STAGE_WIDTH - 40;
    }
    a.sprite.setPosition(a.x, a.y);
    b.sprite.setPosition(b.x, b.y);
  }
}
