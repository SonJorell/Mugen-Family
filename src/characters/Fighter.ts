// ============================================================
// Fighter — Base class for all fighters (player and AI)
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { AnimationRegistry } from '../animation/AnimationRegistry';
import { SpriteSheetLoader } from '../animation/SpriteSheetLoader';
import { CombatState, FighterState } from '../combat/CombatState';
import { Hitbox, Hurtbox, DEFAULT_HURTBOX } from '../combat/Hitbox';
import { AttackDefinition, ATTACK_DEFINITIONS } from '../combat/AttackDefinition';

export interface FighterOptions {
  scene: Phaser.Scene;
  registry: AnimationRegistry;
  loader: SpriteSheetLoader;
  characterId: string;
  x: number;
  y: number;
  maxHealth?: number;
  scale?: number;
}

export class Fighter {
  protected scene: Phaser.Scene;
  protected registry: AnimationRegistry;
  protected loader: SpriteSheetLoader;

  readonly characterId: string;
  sprite!: Phaser.GameObjects.Image;

  // Physics state
  x: number;
  y: number;
  velocityX: number = 0;
  velocityY: number = 0;
  isGrounded: boolean = true;

  // Combat state machine
  combatState: CombatState = new CombatState();

  // Health
  maxHealth: number;
  currentHealth: number;

  // Facing
  facingRight: boolean = true;

  // Scale
  scale: number;

  // Boxes
  hurtbox: Hurtbox;
  hitbox: Hitbox | null = null;

  // Attack frame counters
  protected attackStartup: number = 0;
  protected attackActive: number = 0;
  protected attackRecovery: number = 0;
  protected currentAttackDef: AttackDefinition | null = null;

  // Hit cooldown (prevent multi-hit per swing)
  protected hitCooldown: number = 0;
  hasHitThisSwing: boolean = false;

  // Animation
  protected currentAnimKey: string = '';
  protected animationFrame: number = 0;

  // Debug
  protected debugGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(opts: FighterOptions) {
    this.scene = opts.scene;
    this.registry = opts.registry;
    this.loader = opts.loader;
    this.characterId = opts.characterId;
    this.x = opts.x;
    this.y = opts.y;
    this.maxHealth = opts.maxHealth ?? GAME_CONFIG.MAX_HEALTH;
    this.currentHealth = this.maxHealth;
    this.scale = opts.scale ?? GAME_CONFIG.CHAR_SCALE;

    this.hurtbox = new Hurtbox(this.characterId, DEFAULT_HURTBOX);

    this.createSprite();
    this.setupDebugGraphics();
    this.playAnimation('IDLE');
  }

  private createSprite(): void {
    // Create image using first available frame
    const idleDef = this.registry.get('IDLE');
    const firstFrame = idleDef?.frames?.[0] ?? null;

    if (firstFrame && this.scene.textures.exists(firstFrame)) {
      this.sprite = this.scene.add.image(this.x, this.y, firstFrame);
    } else {
      // Fallback: placeholder rectangle
      const rt = this.scene.add.renderTexture(0, 0, 80, 200);
      rt.fill(0x888888);
      this.sprite = this.scene.add.image(this.x, this.y, rt.texture.key);
      console.warn(`[Fighter] Could not find first frame for ${this.characterId}`);
    }

    this.sprite.setOrigin(GAME_CONFIG.CHAR_ANCHOR_X, GAME_CONFIG.CHAR_ANCHOR_Y);
    this.sprite.setScale(this.scale);
    this.sprite.setDepth(10);
  }

  private setupDebugGraphics(): void {
    if (GAME_CONFIG.DEBUG_MODE) {
      this.debugGraphics = this.scene.add.graphics();
      this.debugGraphics.setDepth(100);
    }
  }

  // ── Animation ────────────────────────────────────────────

  playAnimation(animName: string, forceRestart: boolean = false): void {
    if (!this.registry.has(animName)) {
      if (GAME_CONFIG.DEBUG_MODE) {
        console.warn(`[Fighter:${this.characterId}] Animation not available: ${animName}`);
      }
      // Fallback to IDLE if available
      if (animName !== 'IDLE' && this.registry.has('IDLE')) {
        this.playAnimation('IDLE', forceRestart);
      }
      return;
    }

    const phaserKey = this.loader.getPhaserAnimKey(animName);

    if (!forceRestart && this.currentAnimKey === phaserKey) return;

    this.currentAnimKey = phaserKey;
    this.animationFrame = 0;
    this.startAnimationLoop(animName);
  }

  private animTimer: number = 0;
  private animFrameIdx: number = 0;
  private animDef: { frames: string[]; frameRate: number; repeat: number } | null = null;

  private startAnimationLoop(animName: string): void {
    const def = this.registry.get(animName);
    if (!def || !def.available || def.frames.length === 0) return;

    this.animDef = def;
    this.animFrameIdx = 0;
    this.animTimer = 0;
    this.updateSpriteFrame();
  }

  private advanceAnimation(delta: number): void {
    if (!this.animDef || this.animDef.frames.length === 0) return;

    const frameDuration = 1000 / this.animDef.frameRate;
    this.animTimer += delta;

    if (this.animTimer >= frameDuration) {
      this.animTimer -= frameDuration;
      this.animFrameIdx++;

      if (this.animFrameIdx >= this.animDef.frames.length) {
        if (this.animDef.repeat === -1) {
          this.animFrameIdx = 0;
        } else {
          this.animFrameIdx = this.animDef.frames.length - 1;
          this.onAnimationComplete();
          return;
        }
      }

      this.updateSpriteFrame();
    }

    this.animationFrame = this.animFrameIdx;
  }

  private updateSpriteFrame(): void {
    if (!this.animDef || !this.sprite) return;
    const frameKey = this.animDef.frames[this.animFrameIdx];
    if (frameKey && this.scene.textures.exists(frameKey)) {
      this.sprite.setTexture(frameKey);
    }
  }

  protected onAnimationComplete(): void {
    const state = this.combatState.state;

    if (state === 'ATTACKING' || state === 'SPECIAL') {
      this.endAttack();
    } else if (state === 'HIT') {
      this.combatState.setState('IDLE');
      this.playAnimation('IDLE');
    } else if (state === 'KNOCKED_DOWN') {
      // Wait on last frame, then get up
      this.scene.time.delayedCall(800, () => {
        this.getUp();
      });
    } else if (state === 'GETTING_UP') {
      this.combatState.setState('IDLE');
      this.playAnimation('IDLE');
    } else if (state === 'TAUNTING') {
      this.combatState.setState('IDLE');
      this.playAnimation('IDLE');
    }
  }

  // ── Combat ───────────────────────────────────────────────

  executeAttack(attackName: string): void {
    if (!this.combatState.canAct()) return;

    const attackDef = ATTACK_DEFINITIONS[attackName];
    if (!attackDef) return;

    this.currentAttackDef = attackDef;
    this.attackStartup = attackDef.startup;
    this.attackActive = attackDef.active;
    this.attackRecovery = attackDef.recovery;
    this.hasHitThisSwing = false;

    this.combatState.setState('ATTACKING', attackName);
    this.playAnimation(attackName, true);

    // Create hitbox (Hitbox.getWorldRect handles facing direction cleanly without double inversion)
    this.hitbox = new Hitbox(this.characterId, {
      x: attackDef.hitbox.x,
      y: attackDef.hitbox.y,
      width: attackDef.hitbox.width,
      height: attackDef.hitbox.height,
    });
    this.hitbox.active = false;
  }

  protected updateAttackFrames(delta: number): void {
    if (!this.currentAttackDef) return;

    const frameTime = 1000 / 60;
    const frames = delta / frameTime;

    if (this.attackStartup > 0) {
      this.attackStartup -= frames;
      if (this.attackStartup <= 0) {
        this.hitbox!.active = true;
      }
    } else if (this.attackActive > 0) {
      this.attackActive -= frames;
      if (this.attackActive <= 0) {
        this.hitbox!.active = false;
      }
    }
  }

  private endAttack(): void {
    this.currentAttackDef = null;
    if (this.hitbox) {
      this.hitbox.active = false;
      this.hitbox = null;
    }
    this.attackStartup = 0;
    this.attackActive = 0;
    this.attackRecovery = 0;
    this.hasHitThisSwing = false;
    this.combatState.setState('IDLE');
    this.playAnimation('IDLE');
  }

  receiveHit(damage: number, hitstun: number, knockback: number, causesKnockdown: boolean, fromRight: boolean): void {
    if (this.combatState.state === 'KNOCKED_DOWN' || this.combatState.state === 'GETTING_UP') return;

    if (this.combatState.state === 'BLOCKING') {
      // Chip damage
      this.currentHealth = Math.max(0, this.currentHealth - Math.floor(damage * 0.1));
      return;
    }

    this.currentHealth = Math.max(0, this.currentHealth - damage);

    const kbDir = fromRight ? -1 : 1;
    if (this.currentHealth <= 0) {
      this.combatState.setState('DEFEAT');
      this.playAnimation('DEFEAT', true);
      this.velocityX = kbDir * (knockback * 0.4);
      return;
    }

    if (causesKnockdown) {
      this.knockdown();
    } else {
      this.combatState.setState('HIT');
      this.playAnimation('HIT_REACTION', true);

      this.scene.time.delayedCall(hitstun * (1000 / 60), () => {
        if (this.combatState.state === 'HIT') {
          this.combatState.setState('IDLE');
          this.playAnimation('IDLE');
        }
      });
    }
  }

  private knockdown(): void {
    this.combatState.setState('KNOCKED_DOWN');
    this.playAnimation('KNOCKDOWN', true);
    this.velocityX = 0;
  }

  private getUp(): void {
    if (this.currentHealth <= 0) {
      this.combatState.setState('DEFEAT');
      this.playAnimation('DEFEAT', true);
      return;
    }
    this.combatState.setState('GETTING_UP');
    this.playAnimation('GET_UP', true);
  }

  // ── Physics ──────────────────────────────────────────────

  applyGravity(delta: number): void {
    if (!this.isGrounded) {
      this.velocityY += GAME_CONFIG.GRAVITY * (delta / 1000);
    }
  }

  applyMovement(delta: number): void {
    const dt = delta / 1000;
    this.x += this.velocityX * dt;
    this.y += this.velocityY * dt;

    // Floor collision
    if (this.y >= GAME_CONFIG.FLOOR_Y) {
      this.y = GAME_CONFIG.FLOOR_Y;
      this.velocityY = 0;
      if (!this.isGrounded) {
        this.isGrounded = true;
        if (this.combatState.state === 'JUMPING' || this.combatState.state === 'ATTACKING') {
          this.endAttack();
        }
      }
    }

    // Stage bounds
    const halfWidth = 40;
    const stageLeft  = halfWidth;
    const stageRight = GAME_CONFIG.STAGE_WIDTH - halfWidth;
    this.x = Phaser.Math.Clamp(this.x, stageLeft, stageRight);

    // Friction when grounded
    if (this.isGrounded) {
      this.velocityX *= 0.7;
      if (Math.abs(this.velocityX) < 1) this.velocityX = 0;
    }

    this.sprite.setPosition(this.x, this.y);
  }

  jump(): void {
    if (!this.isGrounded || !this.combatState.canAct()) return;
    this.velocityY = GAME_CONFIG.JUMP_VELOCITY;
    this.isGrounded = false;
    this.combatState.setState('JUMPING');
    this.playAnimation('JUMP', true);
  }

  // ── Facing ───────────────────────────────────────────────

  updateFacing(opponentX: number): void {
    const shouldFaceRight = opponentX > this.x;
    if (shouldFaceRight !== this.facingRight) {
      this.facingRight = shouldFaceRight;
      this.sprite.setFlipX(!this.facingRight);
    }
  }

  // ── Update ───────────────────────────────────────────────

  update(delta: number): void {
    this.combatState.tick(delta);
    this.advanceAnimation(delta);
    this.applyGravity(delta);
    this.updateAttackFrames(delta);
    this.applyMovement(delta);
    this.drawDebug();
  }

  // ── Debug ────────────────────────────────────────────────

  private drawDebug(): void {
    if (!GAME_CONFIG.DEBUG_MODE || !this.debugGraphics) return;

    this.debugGraphics.clear();

    // Draw hurtbox
    if (GAME_CONFIG.SHOW_HURTBOXES) {
      const hr = this.hurtbox.getWorldRect(this.x, this.y, this.facingRight);
      this.debugGraphics.lineStyle(2, 0x00ff00, 0.8);
      this.debugGraphics.strokeRect(hr.worldX, hr.worldY, hr.width, hr.height);
    }

    // Draw hitbox
    if (GAME_CONFIG.SHOW_HITBOXES && this.hitbox?.active) {
      const hb = this.hitbox.getWorldRect(this.x, this.y, this.facingRight);
      this.debugGraphics.lineStyle(2, 0xff0000, 0.9);
      this.debugGraphics.strokeRect(hb.worldX, hb.worldY, hb.width, hb.height);
    }

    // Draw anchor
    if (GAME_CONFIG.SHOW_ANCHOR) {
      this.debugGraphics.fillStyle(0xffff00, 1);
      this.debugGraphics.fillCircle(this.x, this.y, 4);
    }
  }

  getActiveAttackDef(): AttackDefinition | null {
    return this.currentAttackDef;
  }

  getDebugInfo(): Record<string, string> {
    return {
      'Animation': this.combatState.getAnimationName(),
      'Frame': `${this.animationFrame}/${(this.animDef?.frames.length ?? 0) - 1}`,
      'State': this.combatState.state,
      'Position': `${Math.round(this.x)}, ${Math.round(this.y)}`,
      'Facing': this.facingRight ? 'RIGHT' : 'LEFT',
      'Health': `${this.currentHealth}/${this.maxHealth}`,
      'Grounded': this.isGrounded ? 'YES' : 'NO',
    };
  }

  destroy(): void {
    this.sprite?.destroy();
    this.debugGraphics?.destroy();
  }
}
