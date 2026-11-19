// ============================================================
// TrainingOpponent — Static dummy that receives hits
// ============================================================

import { Fighter, FighterOptions } from './Fighter';

export class TrainingOpponent extends Fighter {
  constructor(opts: FighterOptions) {
    super(opts);
  }

  override update(delta: number): void {
    // Dummy is passive — no input processing
    super.update(delta);
  }
}
