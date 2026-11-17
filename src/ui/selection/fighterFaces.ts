import Phaser from 'phaser';
import { menuArtKey } from '../../config/characters';

/** Side, in pixels, of the generated face textures. */
const FACE_SIZE = 160;

export const faceKey = (characterId: string) => `face_${characterId}`;

/**
 * Builds (once) a square close-up of a fighter's face from their full-body menu art, so the
 * selection grid needs no extra artwork. The head is found from the art's transparency: the
 * first opaque rows are the top of the head, and their centre is where the face sits.
 * Returns null when the fighter has no menu art loaded.
 */
export function ensureFaceTexture(scene: Phaser.Scene, characterId: string): string | null {
  const key = faceKey(characterId);
  if (scene.textures.exists(key)) return key;
  const artKey = menuArtKey(characterId);
  if (!scene.textures.exists(artKey)) return null;
  const source = scene.textures.get(artKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const width = source.width, height = source.height;
  if (!width || !height) return null;

  // Read the alpha channel at a small size: plenty to find the head, and cheap.
  const probeW = 128, probeH = Math.max(1, Math.round(height * probeW / width));
  const probe = document.createElement('canvas');
  probe.width = probeW; probe.height = probeH;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  let top = 0, centre = probeW / 2;
  if (ctx) {
    ctx.drawImage(source, 0, 0, probeW, probeH);
    const alpha = ctx.getImageData(0, 0, probeW, probeH).data;
    const opaque = (x: number, y: number) => alpha[(y * probeW + x) * 4 + 3] > 128;
    top = -1;
    for (let y = 0; y < probeH && top < 0; y++) {
      let count = 0;
      for (let x = 0; x < probeW; x++) if (opaque(x, y)) count++;
      if (count >= 3) top = y;
    }
    if (top < 0) top = 0;
    // Average the opaque columns over roughly the height of a head.
    const rows = Math.round(probeH * 0.09);
    let sum = 0, n = 0;
    for (let y = top; y < Math.min(probeH, top + rows); y++) {
      for (let x = 0; x < probeW; x++) if (opaque(x, y)) { sum += x; n++; }
    }
    if (n) centre = sum / n;
  }

  const scale = width / probeW;
  const side = width * 0.3;
  const cx = centre * scale, cy = top * scale + side * 0.5;
  const sx = Phaser.Math.Clamp(cx - side / 2, 0, width - side), sy = Phaser.Math.Clamp(cy - side / 2, 0, height - side);
  const texture = scene.textures.createCanvas(key, FACE_SIZE, FACE_SIZE);
  if (!texture) return null;
  texture.context.drawImage(source, sx, sy, side, side, 0, 0, FACE_SIZE, FACE_SIZE);
  texture.refresh();
  return key;
}
