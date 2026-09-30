// ============================================================
// FacingSystem — Determines which way fighters should face
// ============================================================

import { Fighter } from '../characters/Fighter';

export class FacingSystem {
  update(a: Fighter, b: Fighter): void {
    a.updateFacing(b.x);
    b.updateFacing(a.x);
  }
}
