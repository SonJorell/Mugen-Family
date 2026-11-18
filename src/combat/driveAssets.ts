/** Original transparent cutouts generated for César's i30 cinematic. */
export const DRIVE_ASSETS = {
  'cesar-drive-car': '/assets/effects/cesar-drive/i30-drive.png',
  'cesar-drive-entry': '/assets/effects/cesar-drive-fluid/boarding-sheet.png',
  'cesar-drive-grab': '/assets/effects/cesar-drive-fluid/grab-throw-sheet.png',
  'cesar-drive-throw': '/assets/effects/cesar-drive/cesar-throw.png',
  'cesar-drive-celebrate': '/assets/effects/cesar-drive-fluid/return-sheet.png',
  'tilin-drive-flight': '/assets/effects/tilin-reaction/caught-flight.png',
  'tilin-drive-recover': '/assets/effects/tilin-reaction/ground-recovery.png',
  'tilin-drive-impact': '/assets/effects/tilin-reaction/impact-tumble.png',
  'tilin-drive-airborne': '/assets/effects/tilin-reaction/flight-v2.png',
  'tilin-drive-landing': '/assets/effects/tilin-reaction/landing-v2.png',
} as const;

export const DRIVE_DURATION = 5800;
export const DRIVE_BEATS = [
  { at: 0, damage: 4 },     // Grab confirms.
  { at: 1450, damage: 12 }, // Thrown opponent lands at the far end.
  { at: 3300, damage: 44 }, // The car's front reaches the opponent.
] as const;
