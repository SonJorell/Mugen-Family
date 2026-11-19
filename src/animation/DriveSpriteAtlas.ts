import Phaser from 'phaser';
import { FIGHTER_HEIGHT_CM, heightScale } from '../config/roster';

type Sheet = {
  columns: number; rows: number; anchorX: number; bodyHeight?: number; width?: number; shiftsX?: number[];
  rowCuts?: number[]; columnCuts?: number[][]; referenceFrame?: number; trim?: boolean; bodyWidth?: number;
};
type Pose = { frame: string; originX: number; originY: number; airOriginY: number; floorOffset: number };
export type DriveClip = { key: string; poses: Pose[]; scale: number };

const sheets: Record<string, Sheet> = {
  'cesar-drive-grab': { columns: 4, rows: 3, anchorX: 170 / 384, bodyHeight: 315 * heightScale(FIGHTER_HEIGHT_CM.cesar) },
  'cesar-drive-entry': { columns: 2, rows: 4, anchorX: 0.5, width: 700 },
  'cesar-drive-celebrate': { columns: 4, rows: 3, anchorX: 0.5, bodyHeight: 315 * heightScale(FIGHTER_HEIGHT_CM.cesar) },
  // Generated drawings have uneven gutters. Register their silhouettes, not the empty cell.
  'tilin-drive-flight': { columns: 4, rows: 3, anchorX: 0.5, bodyHeight: 315, trim: true,
    rowCuts: [0, 369, 712, 1024],
    columnCuts: [[0, 384, 768, 1152, 1536], [0, 384, 768, 1147, 1536], [0, 378, 749, 1130, 1536]] },
  'tilin-drive-recover': { columns: 4, rows: 3, anchorX: 0.5, bodyHeight: 315, referenceFrame: 11, trim: true,
    rowCuts: [0, 341, 673, 1024] },
  'tilin-drive-impact': { columns: 4, rows: 3, anchorX: 0.5, bodyHeight: 315, trim: true,
    rowCuts: [0, 394, 683, 1024],
    columnCuts: [[0, 384, 768, 1152, 1536], [0, 384, 752, 1140, 1536], [0, 384, 768, 1143, 1536]] },
  'tilin-drive-airborne': { columns: 4, rows: 4, anchorX: 0.5, bodyWidth: 309, referenceFrame: 15, trim: true,
    rowCuts: [0, 327, 636, 940, 1254],
    columnCuts: [[0, 313, 627, 940, 1254], [0, 313, 627, 940, 1254], [0, 313, 617, 935, 1254], [0, 313, 627, 940, 1254]] },
  'tilin-drive-landing': { columns: 4, rows: 4, anchorX: 0.5, bodyWidth: 309, trim: true },
};
const cache = new WeakMap<Phaser.Textures.TextureManager, Map<string, DriveClip>>();

/** Slice once at preload. Keep one scale per sheet and align feet, never resize each pose. */
export function prepareDriveAtlas(scene: Phaser.Scene): Map<string, DriveClip> {
  const existing = cache.get(scene.textures);
  if (existing) return existing;
  const clips = new Map<string, DriveClip>();
  for (const [key, sheet] of Object.entries(sheets)) {
    const texture = scene.textures.get(key);
    const source = texture.getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const cellWidth = source.width / sheet.columns, cellHeight = source.height / sheet.rows;
    const poses: Pose[] = [];
    let referenceHeight = cellHeight, referenceWidth = cellWidth;
    for (let i = 0; i < sheet.columns * sheet.rows; i++) {
      const column = i % sheet.columns, row = Math.floor(i / sheet.columns);
      const x = sheet.columnCuts?.[row][column] ?? Math.round(column * cellWidth);
      const y = sheet.rowCuts?.[row] ?? Math.round(row * cellHeight);
      const width = (sheet.columnCuts?.[row][column + 1] ?? Math.round((column + 1) * cellWidth)) - x;
      const height = (sheet.rowCuts?.[row + 1] ?? Math.round((row + 1) * cellHeight)) - y;
      let top = height, bottom = 0, left = width, right = 0, totalX = 0, totalY = 0, count = 0;
      // Boarding includes a foot outside the door: align the front tyre to the road.
      const from = sheet.width ? Math.floor(width * 0.65) : 0;
      const to = sheet.width ? Math.ceil(width * 0.88) : width;
      for (let py = 0; py < height; py++) for (let px = from; px < to; px++) {
        if (pixels[((y + py) * source.width + x + px) * 4 + 3] > 64) {
          top = Math.min(top, py); bottom = Math.max(bottom, py + 1);
          left = Math.min(left, px); right = Math.max(right, px + 1);
          totalX += px + 0.5; totalY += py + 0.5; count++;
        }
      }
      if (i === (sheet.referenceFrame ?? 0)) {
        referenceHeight = Math.max(1, bottom - top); referenceWidth = Math.max(1, right - left);
      }
      const frame = `pose-${i}`;
      const cropX = sheet.trim ? Math.max(0, left - 2) : 0;
      const cropY = sheet.trim ? Math.max(0, top - 2) : 0;
      const cropWidth = (sheet.trim ? Math.min(width, right + 2) : width) - cropX;
      const cropHeight = (sheet.trim ? Math.min(height, bottom + 2) : height) - cropY;
      if (!texture.has(frame)) texture.add(frame, 0, x + cropX, y + cropY, cropWidth, cropHeight);
      const centerX = count ? totalX / count : width / 2, centerY = count ? totalY / count : height / 2;
      const anchor = sheet.trim ? centerX : cellWidth * sheet.anchorX + (sheet.shiftsX?.[i] ?? 0);
      poses.push({ frame, originX: (anchor - cropX) / cropWidth, originY: (bottom - cropY) / cropHeight,
        airOriginY: (centerY - cropY) / cropHeight, floorOffset: bottom - centerY });
    }
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    clips.set(key, { key, poses, scale: sheet.width ? sheet.width / cellWidth :
      sheet.bodyWidth ? sheet.bodyWidth / referenceWidth : sheet.bodyHeight! / referenceHeight });
  }
  cache.set(scene.textures, clips);
  return clips;
}

/** A deterministic pose lookup; the cinematic clock owns playback, pause and seeking. */
export function setDrivePose(image: Phaser.GameObjects.Image, clip: DriveClip, position: number): void {
  const pose = clip.poses[Math.max(0, Math.min(clip.poses.length - 1, Math.floor(position)))];
  // Phaser flips the pixels around the frame centre, so mirror the anchor too.
  image.setTexture(clip.key, pose.frame).setOrigin(image.flipX ? 1 - pose.originX : pose.originX, pose.originY).setScale(clip.scale);
}
