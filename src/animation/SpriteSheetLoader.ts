// ============================================================
// SpriteSheetLoader — Generic, reusable sprite loader
//
// Strategy:
//   Each PNG/JPG in a folder contains exactly 3 frames side-by-side.
//   Files are sorted numerically (IDLE_1.jpg, IDLE_2.jpg, IDLE_10.jpg → 1,2,10).
//   Each file is loaded as a texture then split into 3 equal frames.
//   Chroma key (#00FF00) is removed via canvas pixel manipulation.
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { AnimationDefinition } from './AnimationDefinition';
import { AnimationRegistry } from './AnimationRegistry';

const FRAMES_PER_IMAGE = 3;

export interface SpriteGridLayout {
  columns: number;
  rows: number;
  frameCount: number;
  /** A standing pose used to keep physical body scale consistent across moves. */
  referenceFrame?: number;
  alignFeet?: boolean;
  /**
   * Fixed-scale mode for rigged sheets: standing body height in source pixels.
   * Every frame then shares one scale, the cell centre as anchor and `groundY` as floor,
   * instead of re-normalising each animation to its own reference frame.
   */
  sourceBodyHeight?: number;
  /** Floor line inside each nominal cell (source pixels), used with `sourceBodyHeight`. */
  groundY?: number;
}

export interface SpriteSheetOptions extends SpriteGridLayout {
  animations?: Record<string, Partial<SpriteGridLayout> & { frameRate?: number; repeat?: number; impactStart?: number; impactEnd?: number }>;
}

export interface AnimationManifestEntry {
  /** Animation key, e.g. "IDLE" */
  name: string;
  /** Ordered list of image URLs to load (each contains 3 frames) */
  imageUrls: string[];
}

export class SpriteSheetLoader {
  private scene: Phaser.Scene;
  private registry: AnimationRegistry;
  private characterId: string;
  private basePath: string;
  /** If set, reuse processed frame textures from this character ID instead of reprocessing */
  private sourceCharacterId: string | null = null;
  private sheetOptions?: SpriteSheetOptions;

  get displayScale(): number { return this.sheetOptions ? 2 : 1; }

  constructor(
    scene: Phaser.Scene,
    registry: AnimationRegistry,
    characterId: string,
    basePath: string,
    sourceCharacterId: string | null = null,
    sheetOptions?: SpriteSheetOptions,
  ) {
    this.scene = scene;
    this.registry = registry;
    this.characterId = characterId;
    this.basePath = basePath;
    this.sourceCharacterId = sourceCharacterId;
    this.sheetOptions = sheetOptions;
  }

  /**
   * Build a manifest for a set of animation names based on the folder convention.
   * We use a manifest JSON generated at build time OR try known file counts.
   */
  buildManifest(entries: AnimationManifestEntry[]): void {
    for (const entry of entries) {
      this.loadAnimationFromUrls(entry.name, entry.imageUrls);
    }
  }

  /**
   * Load animation images into Phaser's loader queue.
   * Call this inside scene.preload().
   */
  queueLoad(animName: string, imageUrls: string[]): void {
    imageUrls.forEach((url, idx) => {
      const key = this.getRawKey(animName, idx);
      if (!this.scene.textures.exists(key)) {
        this.scene.load.image(key, url);
      }
    });
  }

  /**
   * After all images are loaded, split them into frames and register animations.
   * Call this inside scene.create().
   */
  loadAnimationFromUrls(animName: string, imageUrls: string[]): void {
    // If we're aliasing another character's frames, reuse them directly
    if (this.sourceCharacterId) {
      return this.reuseFromSource(animName, imageUrls.length);
    }

    if (!imageUrls || imageUrls.length === 0) {
      this.registry.register({
        name: animName,
        frames: [],
        frameRate: this.getFrameRate(animName),
        repeat: this.getRepeat(animName),
        available: false,
      });
      console.warn(`[SpriteSheetLoader] Animation ${animName} not found.`);
      return;
    }

    const allFrameKeys: string[] = [];

    imageUrls.forEach((_, imgIdx) => {
      const rawKey = this.getRawKey(animName, imgIdx);

      if (!this.scene.textures.exists(rawKey)) {
        console.warn(`[SpriteSheetLoader] Texture not loaded: ${rawKey}`);
        return;
      }

      // Apply chroma key and split into 3 frames
      const frameKeys = this.sheetOptions
        ? this.splitTransparentGrid(rawKey, animName, imgIdx)
        : this.splitAndChroma(rawKey, animName, imgIdx);
      allFrameKeys.push(...frameKeys);
    });

    if (allFrameKeys.length === 0) {
      this.registry.register({
        name: animName,
        frames: [],
        frameRate: this.getFrameRate(animName),
        repeat: this.getRepeat(animName),
        available: false,
      });
      return;
    }

    // Create Phaser animation
    const phaserKey = this.getPhaserAnimKey(animName);
    if (!this.scene.anims.exists(phaserKey)) {
      this.scene.anims.create({
        key: phaserKey,
        frames: allFrameKeys.map(k => ({ key: k })),
        frameRate: this.getFrameRate(animName),
        repeat: this.getRepeat(animName),
      });
    }

    this.registry.register({
      name: animName,
      frames: allFrameKeys,
      frameRate: this.getFrameRate(animName),
      repeat: this.getRepeat(animName),
      available: true,
      impactStart: this.sheetOptions?.animations?.[animName]?.impactStart,
      impactEnd: this.sheetOptions?.animations?.[animName]?.impactEnd,
    });
  }

  private splitTransparentGrid(rawKey: string, animName: string, imgIdx: number): string[] {
    const layout = { ...this.sheetOptions!, ...this.sheetOptions?.animations?.[animName] };
    const src = this.scene.textures.get(rawKey).getSourceImage() as HTMLImageElement;
    const count = Math.min(layout.frameCount, layout.columns * layout.rows);
    const sourceCanvas = document.createElement('canvas'); sourceCanvas.width = src.width; sourceCanvas.height = src.height;
    const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })!;
    sourceCtx.drawImage(src, 0, 0);
    const sourcePixels = sourceCtx.getImageData(0, 0, src.width, src.height).data;
    // Find a nearby transparent gutter instead of cutting a shoe or outstretched hand.
    const cut = (horizontal: boolean, expected: number, radius: number, from: number, to: number): number => {
      const center = Math.round(expected);
      for (let d = 0; d <= radius; d++) for (const offset of d === 0 ? [0] : [d, -d]) {
        const candidate = center + offset;
        let empty = true;
        for (let p = from; p < to; p++) {
          const x = horizontal ? p : candidate, y = horizontal ? candidate : p;
          if (sourcePixels[(y * src.width + x) * 4 + 3] > 32) { empty = false; break; }
        }
        if (empty) return candidate;
      }
      return center;
    };
    const rowCuts = [0];
    for (let r = 1; r < layout.rows; r++) rowCuts.push(cut(true, r * src.height / layout.rows, src.height / layout.rows * 0.2, 0, src.width));
    rowCuts.push(src.height);
    const colCuts = Array.from({ length: layout.rows }, (_, r) => {
      const cuts = [0];
      for (let c = 1; c < layout.columns; c++) cuts.push(cut(false, c * src.width / layout.columns, src.width / layout.columns * 0.2, rowCuts[r], rowCuts[r + 1]));
      return [...cuts, src.width];
    });
    const frames: { canvas: HTMLCanvasElement; left: number; right: number; top: number; bottom: number; offsetX: number; offsetY: number }[] = [];
    for (let i = 0; i < count; i++) {
      // Rounded cell edges also support dimensions that are not exact grid multiples.
      const col = i % layout.columns, row = Math.floor(i / layout.columns);
      const sx = colCuts[row][col], sy = rowCuts[row];
      const w = colCuts[row][col + 1] - sx, h = rowCuts[row + 1] - sy;
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(src, sx, sy, w, h, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h).data;
      let left = w, right = 0, top = h, bottom = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (pixels[(y * w + x) * 4 + 3] > 32) {
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      frames.push({ canvas, left, right, top, bottom, offsetX: sx - col * src.width / layout.columns, offsetY: sy - row * src.height / layout.rows });
    }
    const reference = frames[layout.referenceFrame ?? 0];
    const referenceHeight = Math.max(1, reference.bottom - reference.top + 1);
    const fixed = typeof layout.sourceBodyHeight === 'number' && layout.sourceBodyHeight > 0;
    const scale = 330 / (fixed ? layout.sourceBodyHeight! : referenceHeight);
    const anchorX = fixed ? src.width / layout.columns / 2 : (reference.left + reference.right) / 2 + reference.offsetX;
    return frames.map((frame, i) => {
      const key = `${this.characterId}_${animName}_${imgIdx * count + i}`;
      if (!this.scene.textures.exists(key)) {
        // Large fixed canvases preserve limbs, alpha, and one consistent foot origin.
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 384;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        const baseline = fixed ? (layout.groundY ?? src.height / layout.rows) - frame.offsetY
          : layout.alignFeet === false ? reference.bottom + reference.offsetY - frame.offsetY + 1 : frame.bottom + 1;
        ctx.drawImage(frame.canvas, 256 + (frame.offsetX - anchorX) * scale, 374.5 - baseline * scale,
          frame.canvas.width * scale, frame.canvas.height * scale);
        this.scene.textures.addCanvas(key, canvas);
      }
      return key;
    });
  }

  /**
   * Split a raw sprite-sheet texture into 3 equal horizontal frames,
   * normalize height/scale across all animations, center each frame,
   * remove chroma key, and strip foreign neighbor bleed.
   */
  private splitAndChroma(rawKey: string, animName: string, imgIdx: number): string[] {
    const rawTexture = this.scene.textures.get(rawKey);
    if (!rawTexture) return [];

    const src = rawTexture.getSourceImage() as HTMLImageElement;
    if (!src || !src.width || !src.height) return [];

    const TARGET_HEIGHT = 768;
    const TARGET_WIDTH = 580; // Generous width so punches and kicks have plenty of room
    const scale = TARGET_HEIGHT / src.height; // Normalize scale (e.g. 2752x1536 -> 0.5)

    const srcColWidth = src.width / FRAMES_PER_IMAGE;
    const frameKeys: string[] = [];

    for (let f = 0; f < FRAMES_PER_IMAGE; f++) {
      const frameKey = `${this.characterId}_${animName}_${imgIdx * FRAMES_PER_IMAGE + f}`;

      if (!this.scene.textures.exists(frameKey)) {
        // Draw single frame to canvas
        const canvas = document.createElement('canvas');
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

        // Column center in original coordinates
        const colCenterX = (f + 0.5) * srcColWidth;

        // Where to place the scaled image on the target canvas so colCenterX aligns with TARGET_WIDTH / 2
        const destX = Math.round(TARGET_WIDTH / 2 - colCenterX * scale);
        const destY = 0;
        const destW = Math.round(src.width * scale);
        const destH = TARGET_HEIGHT;

        ctx.drawImage(src, destX, destY, destW, destH);

        // 1. Remove chroma green and perform de-spill
        this.removeChromaBackground(ctx, TARGET_WIDTH, TARGET_HEIGHT);

        // 2. Remove foreign neighbor bleed (limbs of adjacent characters spilling into this frame)
        this.cleanForeignBleed(ctx, TARGET_WIDTH, TARGET_HEIGHT);

        // Register as Phaser texture
        this.scene.textures.addCanvas(frameKey, canvas);
      }

      frameKeys.push(frameKey);
    }

    return frameKeys;
  }

  /**
   * Remove foreign neighbor bleed (limbs/hair of adjacent frame figures spilling into current frame).
   */
  private cleanForeignBleed(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Step size for connected component grid (4x4 pixels for extreme speed and precision)
    const STEP = 4;
    const gw = Math.ceil(width / STEP);
    const gh = Math.ceil(height / STEP);
    const grid = new Uint8Array(gw * gh);

    // 1. Fill low-res grid with foreground presence
    for (let gy = 0; gy < gh; gy++) {
      const yStart = gy * STEP;
      const yEnd = Math.min(height, yStart + STEP);
      for (let gx = 0; gx < gw; gx++) {
        const xStart = gx * STEP;
        const xEnd = Math.min(width, xStart + STEP);

        let hasFg = 0;
        for (let y = yStart; y < yEnd && !hasFg; y++) {
          for (let x = xStart; x < xEnd; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx + 3] > 20) { // Non-transparent pixel
              hasFg = 1;
              break;
            }
          }
        }
        grid[gy * gw + gx] = hasFg;
      }
    }

    // 2. BFS Connected Component Labeling
    const visited = new Uint8Array(gw * gh);
    const compMap = new Int32Array(gw * gh);
    let compId = 1;
    const compSizes: number[] = [0];
    const compSumX: number[] = [0];

    const queue = new Int32Array(gw * gh);

    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const cellIdx = gy * gw + gx;
        if (grid[cellIdx] === 1 && visited[cellIdx] === 0) {
          const currentId = compId++;
          let head = 0;
          let tail = 0;
          queue[tail++] = cellIdx;
          visited[cellIdx] = 1;

          let count = 0;
          let sumX = 0;

          while (head < tail) {
            const curr = queue[head++];
            compMap[curr] = currentId;
            const cx = curr % gw;
            const cy = Math.floor(curr / gw);
            count++;
            sumX += cx * STEP;

            // 4 neighbors
            if (cx + 1 < gw) {
              const n = cy * gw + (cx + 1);
              if (grid[n] === 1 && visited[n] === 0) { visited[n] = 1; queue[tail++] = n; }
            }
            if (cx - 1 >= 0) {
              const n = cy * gw + (cx - 1);
              if (grid[n] === 1 && visited[n] === 0) { visited[n] = 1; queue[tail++] = n; }
            }
            if (cy + 1 < gh) {
              const n = (cy + 1) * gw + cx;
              if (grid[n] === 1 && visited[n] === 0) { visited[n] = 1; queue[tail++] = n; }
            }
            if (cy - 1 >= 0) {
              const n = (cy - 1) * gw + cx;
              if (grid[n] === 1 && visited[n] === 0) { visited[n] = 1; queue[tail++] = n; }
            }
          }

          compSizes.push(count);
          compSumX.push(sumX);
        }
      }
    }

    if (compId <= 1) return;

    // Find the largest component (the main character body)
    let maxCompId = 1;
    let maxCompSize = compSizes[1] || 0;
    for (let i = 2; i < compId; i++) {
      if (compSizes[i] > maxCompSize) {
        maxCompSize = compSizes[i];
        maxCompId = i;
      }
    }

    const canvasCenterX = width / 2;
    // Mark components to remove
    const removeComp = new Uint8Array(compId);

    for (let i = 1; i < compId; i++) {
      if (i === maxCompId) continue; // Keep main body

      const avgX = compSumX[i] / compSizes[i];
      const distFromCenter = Math.abs(avgX - canvasCenterX);
      const sizeRatio = compSizes[i] / maxCompSize;

      // Component is foreign neighbor if:
      // 1. It's far from center (dist > 165px) AND not a massive body part (> 35% of body)
      // 2. Or it's tiny stray noise (< 8 cells, which is < 128 px)
      const isNeighborBleed = distFromCenter > 165 && sizeRatio < 0.35;
      const isStrayNoise = compSizes[i] < 6;

      if (isNeighborBleed || isStrayNoise) {
        removeComp[i] = 1;
      }
    }

    // 3. Clear rejected components in imageData
    for (let gy = 0; gy < gh; gy++) {
      const yStart = gy * STEP;
      const yEnd = Math.min(height, yStart + STEP);
      for (let gx = 0; gx < gw; gx++) {
        const id = compMap[gy * gw + gx];
        if (id > 0 && removeComp[id] === 1) {
          const xStart = gx * STEP;
          const xEnd = Math.min(width, xStart + STEP);
          for (let y = yStart; y < yEnd; y++) {
            for (let x = xStart; x < xEnd; x++) {
              const idx = (y * width + x) * 4;
              data[idx + 3] = 0; // Transparent
            }
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Remove #00FF00 chroma key background with configurable tolerance.
   */
  removeChromaBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    tolerance: number = GAME_CONFIG.CHROMA_TOLERANCE,
  ): void {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const { r: cr, g: cg, b: cb } = GAME_CONFIG.CHROMA_COLOR;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // A pixel is green background if and only if green dominates BOTH red and blue:
      // Note: Jeans have b > g (b ≈ 200, g ≈ 175), so (g > b) is FALSE.
      // Note: Olive shirt has |g - r| <= 10 (r ≈ 125, g ≈ 133), so (g - r > 20) is FALSE.
      const greenDominates = (g > r) && (g > b) && ((g - r) > 20) && ((g - b) > 20);

      const dist = Math.sqrt(
        (r - cr) * (r - cr) +
        (g - cg) * (g - cg) +
        (b - cb) * (b - cb)
      );

      const isGreenBackground = greenDominates && (dist < tolerance || g > 65);

      if (isGreenBackground) {
        data[i + 3] = 0; // Transparent
      } else if (greenDominates) {
        // Green De-Spill: only on edge pixels where green still exceeds red and blue
        const maxRB = Math.max(r, b);
        data[i + 1] = maxRB; // Neutralize green halo to dark/neutral outline
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  private getRawKey(animName: string, imgIdx: number): string {
    return `${this.characterId}_RAW_${animName}_${imgIdx}`;
  }

  getPhaserAnimKey(animName: string): string {
    return `${this.characterId}_anim_${animName}`;
  }

  private getFrameRate(animName: string): number {
    return this.sheetOptions?.animations?.[animName]?.frameRate ?? GAME_CONFIG.ANIM_FRAMERATES[animName]?.frameRate ?? 8;
  }

  private getRepeat(animName: string): number {
    return this.sheetOptions?.animations?.[animName]?.repeat ?? GAME_CONFIG.ANIM_FRAMERATES[animName]?.repeat ?? 0;
  }

  /**
   * Reuse already-processed frames from a source character.
   * This allows the dummy to share Tilin's frame textures.
   */
  private reuseFromSource(animName: string, fileCount: number): void {
    const srcId = this.sourceCharacterId!;

    if (fileCount === 0) {
      this.registry.register({
        name: animName,
        frames: [],
        frameRate: this.getFrameRate(animName),
        repeat: this.getRepeat(animName),
        available: false,
      });
      return;
    }

    // Collect already-processed frame keys from source character
    const allFrameKeys: string[] = [];
    for (let imgIdx = 0; imgIdx < fileCount; imgIdx++) {
      const frameCount = this.sheetOptions?.animations?.[animName]?.frameCount ?? this.sheetOptions?.frameCount ?? FRAMES_PER_IMAGE;
      for (let f = 0; f < frameCount; f++) {
        const frameKey = `${srcId}_${animName}_${imgIdx * frameCount + f}`;
        if (this.scene.textures.exists(frameKey)) {
          allFrameKeys.push(frameKey);
        }
      }
    }

    if (allFrameKeys.length === 0) {
      this.registry.register({
        name: animName,
        frames: [],
        frameRate: this.getFrameRate(animName),
        repeat: this.getRepeat(animName),
        available: false,
      });
      return;
    }

    // Create a separate Phaser animation key for this character
    const phaserKey = this.getPhaserAnimKey(animName);
    if (!this.scene.anims.exists(phaserKey)) {
      this.scene.anims.create({
        key: phaserKey,
        frames: allFrameKeys.map(k => ({ key: k })),
        frameRate: this.getFrameRate(animName),
        repeat: this.getRepeat(animName),
      });
    }

    this.registry.register({
      name: animName,
      frames: allFrameKeys,
      frameRate: this.getFrameRate(animName),
      repeat: this.getRepeat(animName),
      available: true,
      impactStart: this.sheetOptions?.animations?.[animName]?.impactStart,
      impactEnd: this.sheetOptions?.animations?.[animName]?.impactEnd,
    });
  }
}
