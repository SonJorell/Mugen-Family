// ============================================================
// TilinCantoSequence — Tilin's «Canto resonante» super cinematic
// ============================================================

import Phaser from 'phaser';
import type { Fighter } from '../characters/Fighter';
import type { RosterEntry } from '../config/roster';
import { superPortraitKey } from '../config/characters';
import { FONT_UI, FONT_IMPACT } from '../ui/fonts';
import type { SuperSequence } from './SuperSequence';

export const CANTO_DURATION = 3000;
export const CANTO_BEATS = [
  { at: 0, damage: 4 }, { at: 900, damage: 7 }, { at: 1200, damage: 7 },
  { at: 1500, damage: 7 }, { at: 1800, damage: 7 }, { at: 2100, damage: 8 }, { at: 2600, damage: 20 },
] as const;

/** Presentation for Tilin's vocal barrage (also fallback for any fighter using the 'sonic' super). */
export class TilinCantoSequence implements SuperSequence {
  readonly layer: Phaser.GameObjects.Container;
  readonly duration = CANTO_DURATION;
  readonly beats = CANTO_BEATS;
  readonly soundKey = 'super-canto';
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly caster: Phaser.GameObjects.Image;
  private readonly victim: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly progress: Phaser.GameObjects.Rectangle;
  private readonly casterX: number;
  private readonly victimX: number;
  private expanded = false;

  constructor(
    scene: Phaser.Scene,
    private readonly attacker: Fighter,
    private readonly defender: Fighter,
    private readonly casterEntry: RosterEntry,
    private readonly fromRight: boolean,
    stageTexture: string,
  ) {
    this.casterX = fromRight ? 950 : 330;
    this.victimX = fromRight ? 330 : 950;
    this.layer = scene.add.container(0, 0).setDepth(45).setScrollFactor(0).setName('super-cinematic');
    this.layer.add(scene.add.image(640, 360, stageTexture).setName('canto-stage').setDisplaySize(1580, 900).setTint(0x718c9c));
    this.layer.add(scene.add.rectangle(640, 360, 1280, 720, 0x071321, 0.56));
    this.layer.add(scene.add.rectangle(640, 101, 1280, 76, 0x061019, 0.96));
    this.layer.add(scene.add.rectangle(640, 686, 1280, 90, 0x061019, 0.96));
    this.art = scene.add.graphics();
    this.layer.add(this.art);
    this.caster = scene.add.image(this.casterX, 605, attacker.sprite.texture.key).setName('canto-caster').setOrigin(0.5, 0.975)
      .setScale(1.06 * attacker.stats.size).setFlipX(fromRight).setTint(attacker.sprite.tintTopLeft);
    this.victim = scene.add.image(this.victimX, 605, defender.sprite.texture.key).setName('canto-victim').setOrigin(0.5, 0.975)
      .setScale(1.06 * defender.stats.size).setFlipX(!fromRight).setTint(defender.sprite.tintTopLeft);
    this.layer.add([this.caster, this.victim]);
    this.portrait = scene.add.image(fromRight ? 890 : 390, 399, superPortraitKey(casterEntry.id))
      .setDisplaySize(780, 520).setFlipX(fromRight).setTint(attacker.sprite.tintTopLeft);
    this.layer.add(this.portrait);
    this.title = scene.add.text(fromRight ? 360 : 900, 220, casterEntry.superName, {
      fontFamily: FONT_IMPACT, fontSize: '66px', color: '#fff3d8', align: 'center',
      stroke: '#143a51', strokeThickness: 4, lineSpacing: -6,
    }).setOrigin(0.5, 0);
    this.counter = scene.add.text(fromRight ? 360 : 900, 402, `El poder de ${casterEntry.name}`, {
      fontFamily: FONT_UI, fontSize: '22px', color: '#f5bd75',
    }).setOrigin(0.5, 0);
    this.layer.add([this.title, this.counter]);
    this.layer.add(scene.add.rectangle(280, 653, 720, 4, 0x263c51).setOrigin(0, 0.5));
    this.progress = scene.add.rectangle(280, 653, 1, 4, 0x9fe8e1).setOrigin(0, 0.5);
    this.layer.add(this.progress);
    this.layer.add(scene.add.text(640, 677, 'Súper confirmado · Esc para pausar', {
      fontFamily: FONT_UI, fontSize: '17px', color: '#c7d6dd',
    }).setOrigin(0.5, 0));
  }

  render(t: number, damage: number, reduced: boolean): void {
    const intro = t < 800;
    const beatCount = CANTO_BEATS.filter(b => t + 0.001 >= b.at).length;
    this.caster.setTexture(this.attacker.sprite.texture.key).setVisible(!intro);
    this.victim.setTexture(this.defender.sprite.texture.key).setVisible(!intro);
    this.portrait.setAlpha(intro ? 1 : Math.max(0, 1 - (t - 800) / 180));
    if (!intro && !this.expanded) {
      this.expanded = true;
      this.title.setText(this.casterEntry.superName.replace('\n', ' ')).setFontSize(40).setPosition(640, 153);
      this.counter.setPosition(640, 210);
    }
    if (!intro) this.counter.setText(`${beatCount} impactos   ·   ${damage} de daño`);
    this.progress.setDisplaySize(720 * t / CANTO_DURATION, 4);
    const sinceHit = t - CANTO_BEATS[Math.max(0, beatCount - 1)].at;
    const pulse = Math.max(0, 1 - sinceHit / 230);
    const direction = this.fromRight ? -1 : 1;
    this.victim.setX(this.victimX + (reduced ? 0 : Math.sin(sinceHit * 0.11) * pulse * 10));
    const g = this.art.clear();
    // Broad quiet light cones keep the portrait readable before the full vocal barrage.
    g.fillStyle(0x143a51, 0.5).fillTriangle(0, 640, 640, 170, 1280, 640);
    g.lineStyle(2, 0xf5bd75, 0.5).lineBetween(40, 140, 1240, 140);
    if (intro) {
      for (let i = 0; i < 5; i++) {
        g.lineStyle(2, 0x9fe8e1, 0.12 + i * 0.02);
        g.strokeCircle(this.fromRight ? 900 : 380, 390, 120 + i * 47 + (reduced ? 0 : t * 0.035));
      }
      return;
    }
    const mouth = this.casterX + direction * 54;
    g.fillStyle(0x061019, 0.4).fillEllipse(this.casterX, 608, 190, 18).fillEllipse(this.victimX, 608, 190, 18);
    g.fillStyle(0x9fe8e1, 0.06 + pulse * 0.1)
      .fillTriangle(mouth, 315, this.victimX + direction * 70, 230, this.victimX + direction * 70, 590);
    for (let i = 0; i < 6; i++) {
      const travel = reduced ? i / 6 : ((t - 800) / 520 + i / 6) % 1;
      const x = mouth + (this.victimX - mouth) * travel;
      const size = 75 + travel * 150;
      g.lineStyle(8 - travel * 4, i % 2 ? 0xf5bd75 : 0x9fe8e1, 0.7 * (1 - travel * 0.5));
      g.strokeEllipse(x, 315 + travel * 80, 30 + travel * 50, size);
    }
    // Musical notes and concentric pressure rings are driven by the same beat as damage.
    for (let i = 0; i < 8; i++) {
      const x = 480 + (i % 4) * 95, y = 285 + Math.floor(i / 4) * 220 - (reduced ? 0 : Math.sin(t / 240 + i) * 20);
      g.fillStyle(i % 2 ? 0xf5bd75 : 0x9fe8e1, 0.6).fillEllipse(x, y, 12, 8);
      g.lineStyle(2, 0xfff3d8, 0.6).lineBetween(x + 5, y, x + 5, y - 24);
    }
    if (pulse > 0) {
      const final = beatCount === CANTO_BEATS.length;
      for (let i = 0; i < (final ? 5 : 3); i++) {
        g.lineStyle(final ? 6 : 3, i % 2 ? 0x9fe8e1 : 0xf5bd75, pulse * 0.8);
        g.strokeCircle(this.victimX, 395, 45 + i * 40 + (reduced ? 0 : (1 - pulse) * 90));
      }
      if (final) g.lineStyle(8, 0xf5bd75, pulse * 0.7).strokeRect(12, 143, 1256, 497);
    }
  }
}
