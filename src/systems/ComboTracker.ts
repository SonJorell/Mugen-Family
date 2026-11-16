// ============================================================
// ComboTracker — Counts hits landed while the defender is still in hitstun
// ============================================================

import type { Fighter } from '../characters/Fighter';

export interface Combo { hits: number; damage: number; }

/** States in which a defender cannot act yet, so a further hit keeps the combo alive. */
const HELD_STATES = new Set(['HIT', 'STUNNED', 'JUGGLED']);

/**
 * Pure bookkeeping, keyed by attacker. The scene calls `registerHit` for every landed hit and
 * `update` once per simulated frame; the HUD listens through `onChange` and `onEnd`.
 */
export class ComboTracker {
  private combos = new Map<Fighter, { combo: Combo; defender: Fighter; open: boolean }>();
  onChange?: (attacker: Fighter, combo: Combo) => void;
  onEnd?: (attacker: Fighter, combo: Combo) => void;

  /** Current combo of an attacker, or null. */
  get(attacker: Fighter): Combo | null { return this.combos.get(attacker)?.combo ?? null; }

  /** The combo the next hit would extend: open, on this defender, who is still unable to act. */
  ongoing(attacker: Fighter, defender: Fighter): Combo | null {
    const entry = this.combos.get(attacker);
    return entry && entry.open && entry.defender === defender && HELD_STATES.has(defender.combatState.state) ? entry.combo : null;
  }

  registerHit(attacker: Fighter, defender: Fighter, damage: number): void {
    const entry = this.combos.get(attacker);
    if (entry && entry.open && entry.defender === defender) {
      entry.combo = { hits: entry.combo.hits + 1, damage: entry.combo.damage + damage };
    } else {
      if (entry) this.finish(attacker);
      this.combos.set(attacker, { combo: { hits: 1, damage }, defender, open: true });
    }
    // A hit that knocks down or finishes the defender closes the combo on the next update.
    const current = this.combos.get(attacker)!;
    current.open = HELD_STATES.has(defender.combatState.state);
    this.onChange?.(attacker, current.combo);
  }

  /** Ends combos whose defender has left hitstun. */
  update(): void {
    for (const [attacker, entry] of [...this.combos]) {
      if (!entry.open || !HELD_STATES.has(entry.defender.combatState.state)) this.finish(attacker);
    }
  }

  /** Clears everything without reporting (new round, super). */
  reset(): void { this.combos.clear(); }

  private finish(attacker: Fighter): void {
    const entry = this.combos.get(attacker);
    if (!entry) return;
    this.combos.delete(attacker);
    this.onEnd?.(attacker, entry.combo);
  }
}
