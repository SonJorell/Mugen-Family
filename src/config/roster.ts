export interface FighterChoice { characterId: string; paletteId: string; }

export const FIGHTER_ROSTER = [
  { id: 'tilin', name: 'Tilin', power: 'Canto sónico', description: 'Una onda de voz que daña y aturde.' },
] as const;

export const FIGHTER_PALETTES = [
  { id: 'original', name: 'Original', tint: 0xffffff, swatch: 0xc7b58d },
  { id: 'amethyst', name: 'Amatista', tint: 0xc8b3e8, swatch: 0xc8b3e8 },
  { id: 'mint', name: 'Menta', tint: 0xa5e0d4, swatch: 0xa5e0d4 },
  { id: 'coral', name: 'Coral', tint: 0xf2b8ad, swatch: 0xf2b8ad },
] as const;

export function normalizeChoice(choice?: FighterChoice, defaultPalette = 'original'): FighterChoice {
  return {
    characterId: FIGHTER_ROSTER.find(f => f.id === choice?.characterId)?.id ?? 'tilin',
    paletteId: FIGHTER_PALETTES.find(p => p.id === choice?.paletteId)?.id ?? defaultPalette,
  };
}
export function fighterPalette(choice: FighterChoice) {
  return FIGHTER_PALETTES.find(p => p.id === choice.paletteId) ?? FIGHTER_PALETTES[0];
}
