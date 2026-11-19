/** Original transparent cutouts generated for César's i30 cinematic. */
export const DRIVE_ASSETS = {
  'cesar-drive-car': '/assets/effects/cesar-drive/i30-drive.webp',
  'cesar-drive-entry': '/assets/effects/super-unified/cesar-boarding-scaled.webp',
  'cesar-drive-grab': '/assets/effects/super-unified/cesar-grab.webp',
  'cesar-drive-celebrate': '/assets/effects/super-unified/cesar-return.webp',
  'tilin-drive-flight': '/assets/effects/super-unified/tilin-flight.webp',
  'tilin-drive-recover': '/assets/effects/super-unified/tilin-recover.webp',
  'tilin-drive-impact': '/assets/effects/super-unified/tilin-impact.webp',
  'tilin-drive-airborne': '/assets/effects/super-unified/tilin-airborne.webp',
  'tilin-drive-landing': '/assets/effects/super-unified/tilin-landing.webp',
} as const;

export const DRIVE_DURATION = 5800;
export const DRIVE_BEATS = [
  { at: 0, damage: 4 },     // Grab confirms.
  { at: 1450, damage: 12 }, // Thrown opponent lands at the far end.
  { at: 3300, damage: 44 }, // The car's front reaches the opponent.
] as const;
