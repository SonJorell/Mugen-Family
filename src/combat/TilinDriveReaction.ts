import Phaser from 'phaser';
import { DriveClip, setDrivePose } from '../animation/DriveSpriteAtlas';
import { DRIVE_BEATS } from './driveAssets';

const span = (t: number, start: number, end: number) => Phaser.Math.Clamp((t - start) / (end - start), 0, 1);
const smooth = (q: number) => q * q * (3 - 2 * q);
const mix = Phaser.Math.Linear;

/** Anatomical reaction drawings driven by the same clock as the i30's damage beats. */
export class TilinDriveReaction {
  groundDistance = 0;
  private readonly defeatedBeforeCar: boolean;

  constructor(private image: Phaser.GameObjects.Image, private clips: Map<string, DriveClip>,
    private fromRight: boolean, private size: number, private floor: number, initialHealth: number) {
    image.setFlipX(!fromRight);
    // Capture the starting health so direct seeks reproduce the same impact posture.
    this.defeatedBeforeCar = initialHealth <= DRIVE_BEATS.slice(0, 2).reduce((sum, beat) => sum + beat.damage, 0);
  }

  private offset(key: string, index: number): number {
    const clip = this.clips.get(key)!;
    return clip.poses[index].floorOffset * clip.scale * this.size;
  }

  render(t: number, defeated: boolean, reduced: boolean): void {
    let key: string, pose: number, x: number, lift = 0, airborneY: number | undefined;
    if (t < 550) {
      const q = span(t, 0, 550);
      key = 'tilin-drive-flight'; pose = 6 * q;
      x = mix(440, 410, smooth(q)); lift = 52 * smooth(q);
    } else if (t < 1450) {
      const q = span(t, 550, 1450);
      key = 'tilin-drive-airborne'; pose = 15.999 * q;
      x = mix(410, 1060, q);
      // The body follows one arc; folding the legs must not teleport its centre of mass.
      const startY = this.floor - 52 - this.offset('tilin-drive-flight', 5);
      const endY = this.floor - this.offset('tilin-drive-landing', 0);
      airborneY = mix(startY, endY, q) - 4 * q * (1 - q) * (reduced ? 100 : 190);
      lift = 52 * (1 - q) + 4 * q * (1 - q) * (reduced ? 100 : 190);
    } else if (t < 3300) {
      if (t < 2250 || defeated) {
        key = 'tilin-drive-landing';
        // A fatal throw settles into a low pose instead of starting the get-up.
        pose = (defeated ? 7.999 : 15.999) * span(t, 1450, 2250);
      } else {
        key = 'tilin-drive-recover'; pose = 4 + 7.999 * span(t, 2250, 3250);
      }
      x = 1060;
    } else if (t < 4050) {
      const q = span(t, 3300, 4050);
      key = 'tilin-drive-impact'; pose = this.defeatedBeforeCar ? 7 + 2.999 * q : 9.999 * q;
      x = mix(1060, 1070, smooth(q));
      const startY = this.floor - (this.defeatedBeforeCar ? this.offset('tilin-drive-landing', 7) : this.offset('tilin-drive-recover', 11));
      const endY = this.floor - (defeated ? this.offset('tilin-drive-impact', 9) : this.offset('tilin-drive-landing', 0));
      airborneY = mix(startY, endY, q) - 4 * q * (1 - q) * (reduced ? 65 : 150);
      lift = 4 * q * (1 - q) * (reduced ? 65 : 150);
    } else if (defeated) {
      key = 'tilin-drive-impact'; pose = 9 + 2.999 * span(t, 4050, 4350);
      x = 1070;
    } else if (t < 4650) {
      key = 'tilin-drive-landing'; pose = 15.999 * span(t, 4050, 4650);
      x = 1070;
    } else {
      key = 'tilin-drive-recover'; pose = 4 + 7.999 * span(t, 4650, 5700);
      x = 1070;
    }
    const clip = this.clips.get(key)!;
    this.groundDistance = lift;
    setDrivePose(this.image, clip, pose);
    if (airborneY !== undefined) {
      const frame = clip.poses[Math.min(clip.poses.length - 1, Math.floor(pose))];
      this.image.setOrigin(this.image.originX, frame.airOriginY);
    }
    this.image.setScale(clip.scale * this.size).setAngle(0)
      .setPosition(this.fromRight ? 1280 - x : x, airborneY ?? this.floor - lift);
  }
}
