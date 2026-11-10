/** Original transparent cutouts generated for César's i30 cinematic. */
export const DRIVE_ASSETS = {
  'cesar-drive-car': '/assets/effects/cesar-drive/i30-drive.png',
  'cesar-drive-entry': '/assets/effects/cesar-drive/i30-enter.png',
  'cesar-drive-grab': '/assets/effects/cesar-drive/cesar-grab.png',
  'cesar-drive-throw': '/assets/effects/cesar-drive/cesar-throw.png',
  'cesar-drive-celebrate': '/assets/effects/cesar-drive/cesar-monster.png',
} as const;

export const DRIVE_DURATION = 5800;
export const DRIVE_BEATS = [
  { at: 0, damage: 4 },     // Grab confirms.
  { at: 1450, damage: 12 }, // Thrown opponent lands at the far end.
  { at: 3300, damage: 44 }, // The car's front reaches the opponent.
] as const;
