// ============================================================
// Stats — Results kept in the browser: wins, losses, best combo, arcade clears
// ============================================================

const STORAGE_KEY = 'fighter-stats';

export interface FighterRecord { wins: number; losses: number; draws: number; }

export interface PlayerStats {
  /** Matches against the CPU (free matches and arcade), from player 1's side. */
  vsCpu: FighterRecord;
  /** The same, split by the fighter player 1 used. */
  byFighter: Record<string, FighterRecord>;
  /** Two-player matches played, and how many each side won. */
  versus: { played: number; p1: number; p2: number };
  bestCombo: { hits: number; damage: number; fighter: string } | null;
  /** Arcade clears per fighter and the fewest continues used in a clear. */
  arcade: Record<string, { clears: number; fewestContinues: number }>;
}

export function emptyStats(): PlayerStats {
  return { vsCpu: { wins: 0, losses: 0, draws: 0 }, byFighter: {}, versus: { played: 0, p1: 0, p2: 0 }, bestCombo: null, arcade: {} };
}

export function loadStats(): PlayerStats {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return saved && typeof saved === 'object' ? { ...emptyStats(), ...saved } : emptyStats();
  } catch { return emptyStats(); }
}

function save(stats: PlayerStats): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch { /* Stats are optional. */ }
}

export function resetStats(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/** A finished match. Practice matches are not recorded. */
export function recordMatch(mode: string, playerFighter: string, winner: 'player' | 'opponent' | 'draw'): void {
  if (mode === 'training') return;
  const stats = loadStats();
  if (mode === 'versus') {
    stats.versus.played++;
    if (winner === 'player') stats.versus.p1++; else if (winner === 'opponent') stats.versus.p2++;
  } else {
    const field = winner === 'player' ? 'wins' : winner === 'opponent' ? 'losses' : 'draws';
    stats.vsCpu[field]++;
    const record = stats.byFighter[playerFighter] ?? { wins: 0, losses: 0, draws: 0 };
    record[field]++;
    stats.byFighter[playerFighter] = record;
  }
  save(stats);
}

/** A combo landed by a human player; keeps the longest (then the most damaging). */
export function recordCombo(hits: number, damage: number, fighter: string): void {
  if (hits < 2) return;
  const stats = loadStats(), best = stats.bestCombo;
  if (!best || hits > best.hits || (hits === best.hits && damage > best.damage)) {
    stats.bestCombo = { hits, damage, fighter };
    save(stats);
  }
}

export function recordArcadeClear(fighter: string, continues: number): void {
  const stats = loadStats();
  const entry = stats.arcade[fighter] ?? { clears: 0, fewestContinues: continues };
  entry.clears++;
  entry.fewestContinues = Math.min(entry.fewestContinues, continues);
  stats.arcade[fighter] = entry;
  save(stats);
}
