// ============================================================
// Fighter — Base class for all fighters (player and AI)
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { AnimationRegistry } from '../animation/AnimationRegistry';
import { AnimationDefinition } from '../animation/AnimationDefinition';
import { SpriteSheetLoader } from '../animation/SpriteSheetLoader';
import { CombatState } from '../combat/CombatState';
import { Hitbox, Hurtbox, DEFAULT_HURTBOX } from '../combat/Hitbox';
import { AttackDefinition, ATTACK_DEFINITIONS, COMMAND_MOVES, DRIVE_GRAB_ATTACK } from '../combat/AttackDefinition';
import { SonicWave } from '../combat/SonicWave';
import { DEFAULT_STATS, FighterStats } from '../config/roster';

export interface FighterOptions {
  scene: Phaser.Scene;
  registry: AnimationRegistry;
  loader: SpriteSheetLoader;
  characterId: string;
  x: number;
  y: number;
  maxHealth?: number;
  scale?: number;
  stats?: FighterStats;
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
  private jumpsUsed = 0;

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
  private stunDuration = 0;
  private knockdownDuration = 0;
  sonicWaves: SonicWave[] = [];
  private sonicReleased = false;
  private energyValue = 0;
  get energy(): number { return this.energyValue; }
  get superReady(): boolean { return this.energyValue >= 100; }
  get inSuper(): boolean { return this.combatState.state === 'SPECIAL' || this.combatState.state === 'SUPER_CAUGHT'; }
  /** Who holds this fighter in a throw, while GRABBED. */
  grabbedBy: Fighter | null = null;

  /** Can a throw take this fighter now? Not in the air, nor while stunned, guarding a hit or down. */
  get throwable(): boolean {
    return this.isGrounded && this.canReceiveHit
      && !['HIT', 'STUNNED', 'BLOCKSTUN', 'JUGGLED', 'KNOCKED_DOWN', 'GETTING_UP'].includes(this.combatState.state);
  }

  /** A throw connected: held in front of the thrower until it lands or is broken. */
  grabbedFrom(thrower: Fighter): void {
    this.cancelAttack(); this.clearSonicWaves();
    this.velocityX = 0; this.velocityY = 0;
    this.hurtbox.rect = this.standingHurtbox;
    this.grabbedBy = thrower;
    this.combatState.setState('GRABBED');
    this.playAnimation('HIT_REACTION', true);
  }

  /** Breaks the throw if still inside the window: both fighters are pushed apart, no damage. */
  techThrow(): boolean {
    const thrower = this.grabbedBy;
    if (this.combatState.state !== 'GRABBED' || !thrower || this.combatState.stateTimer > GAME_CONFIG.GRAB.TECH_WINDOW_MS) return false;
    this.grabbedBy = null;
    const away = this.x >= thrower.x ? 1 : -1;
    this.combatState.setState('IDLE'); this.playAnimation('IDLE', true);
    this.velocityX = away * GAME_CONFIG.GRAB.TECH_PUSH;
    thrower.endAttack();
    thrower.velocityX = -away * GAME_CONFIG.GRAB.TECH_PUSH;
    this.playImpactSound('hit-block');
    return true;
  }

  private updateGrab(): void {
    const thrower = this.grabbedBy;
    if (this.combatState.state !== 'GRABBED' || !thrower) return;
    const side = thrower.facingRight ? 1 : -1;
    this.x = thrower.x + side * GAME_CONFIG.GRAB.HOLD_DISTANCE * Math.max(thrower.stats.size, this.stats.size);
    if (this.combatState.stateTimer < GAME_CONFIG.GRAB.TECH_WINDOW_MS) return;
    // Not broken in time: the throw lands.
    const def = thrower.getActiveAttackDef();
    const damage = def?.throw ? def.damage : Math.round(13 * thrower.stats.damage);
    this.grabbedBy = null;
    this.combatState.setState('IDLE');
    if (this.receiveHit(damage, 0, def?.knockback ?? 420, true, thrower.x > this.x) === 'hit') thrower.gainEnergy(damage * 2 + 6);
  }

  /** Air hits taken in the current juggle. */
  juggleHits = 0;
  /** A juggle that reached its hit limit cannot be hit again until the fighter lands. */
  get juggleSpent(): boolean {
    return this.combatState.state === 'JUGGLED' && this.juggleHits >= GAME_CONFIG.JUGGLE.MAX_HITS;
  }
  /** Direction of the current dash in screen terms (1 right, −1 left) and whether it goes back. */
  private dashSign = 0;
  dashBack = false;
  /** The first frames of a back dash cannot be hit. */
  get dashInvulnerable(): boolean {
    return this.combatState.state === 'DASHING' && this.dashBack && this.combatState.stateTimer < GAME_CONFIG.DASH.BACK.INVULN_MS;
  }
  get canReceiveHit(): boolean {
    return this.currentHealth > 0 && !this.inSuper && !this.dashInvulnerable && !this.juggleSpent && this.combatState.state !== 'GRABBED' && !['KNOCKED_DOWN', 'GETTING_UP', 'DEFEAT', 'VICTORY'].includes(this.combatState.state);
  }
  private stunArt!: Phaser.GameObjects.Graphics;

  // Hit cooldown (prevent multi-hit per swing)
  protected hitCooldown: number = 0;
  hasHitThisSwing: boolean = false;
  /** Increases with every attack started, so observers can tell back-to-back attacks apart. */
  attackSerial = 0;

  // Animation
  protected currentAnimKey: string = '';
  protected animationFrame: number = 0;

  // Debug
  protected debugGraphics: Phaser.GameObjects.Graphics | null = null;

  readonly stats: FighterStats;

  /** Standing hurtbox grown with the fighter's size. */
  get standingHurtbox() { return this.sizedBox(DEFAULT_HURTBOX); }
  /** Crouching hurtbox grown with the fighter's size. */
  get crouchHurtbox() { return this.sizedBox({ x: -45, y: -160, width: 90, height: 160 }); }
  get walkSpeed(): number { return GAME_CONFIG.WALK_SPEED * this.stats.walkSpeed; }

  private sizedBox(box: { x: number; y: number; width: number; height: number }) {
    const k = this.stats?.size ?? 1;
    return k === 1 ? box : { x: box.x * k, y: box.y * k, width: box.width * k, height: box.height * k };
  }

  /** Applies the fighter's speed, damage and reach to a shared attack definition. */
  private scaleAttack(def: AttackDefinition): AttackDefinition {
    const s = this.stats;
    if (s.attackSpeed === 1 && s.damage === 1 && s.size === 1) return def;
    const frames = (n: number) => Math.max(1, Math.round(n / s.attackSpeed));
    return {
      ...def,
      startup: frames(def.startup), active: frames(def.active), recovery: frames(def.recovery),
      damage: Math.round(def.damage * s.damage),
      hitbox: this.sizedBox(def.hitbox),
    };
  }

  constructor(opts: FighterOptions) {
    this.scene = opts.scene;
    this.registry = opts.registry;
    this.loader = opts.loader;
    this.characterId = opts.characterId;
    this.x = opts.x;
    this.y = opts.y;
    this.maxHealth = opts.maxHealth ?? GAME_CONFIG.MAX_HEALTH;
    this.currentHealth = this.maxHealth;
    this.stats = opts.stats ?? DEFAULT_STATS;
    this.scale = (opts.scale ?? GAME_CONFIG.CHAR_SCALE) * this.stats.size;

    this.hurtbox = new Hurtbox(this.characterId, this.standingHurtbox);

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
    this.sprite.setScale(this.scale * this.loader.displayScale);
    this.sprite.setDepth(10);
  }

  private setupDebugGraphics(): void {
    this.debugGraphics = this.scene.add.graphics().setDepth(100);
    this.stunArt = this.scene.add.graphics().setDepth(20);
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
  private animDef: AnimationDefinition | null = null;
  private animationComplete = false;

  private startAnimationLoop(animName: string): void {
    const def = this.registry.get(animName);
    if (!def || !def.available || def.frames.length === 0) return;

    this.animDef = def;
    this.animFrameIdx = 0;
    this.animTimer = 0;
    this.animationComplete = false;
    this.updateSpriteFrame();
  }

  private advanceAnimation(delta: number): void {
    if (!this.animDef || this.animDef.frames.length === 0 || this.animationComplete) return;

    const attack = this.currentAttackDef;
    if (attack && this.animDef.impactStart !== undefined && this.animDef.impactEnd !== undefined) {
      const frameTime = this.combatState.stateTimer * 60 / 1000;
      const start = this.animDef.impactStart, end = this.animDef.impactEnd, count = this.animDef.frames.length;
      const position = frameTime < attack.startup
        ? frameTime / attack.startup * start
        : frameTime < attack.startup + attack.active
          ? start + (frameTime - attack.startup) / attack.active * (end - start)
          : end + (frameTime - attack.startup - attack.active) / attack.recovery * (count - end);
      this.animFrameIdx = Math.min(count - 1, Math.floor(position + 1e-6));
      this.animationFrame = this.animFrameIdx;
      this.updateSpriteFrame();
      return;
    }
    const frameDuration = attack
      ? ((attack.startup + attack.active + attack.recovery) * 1000 / 60) / this.animDef.frames.length
      : 1000 / this.animDef.frameRate;
    this.animTimer += delta;

    while (this.animTimer >= frameDuration && !this.animationComplete) {
      this.animTimer -= frameDuration;
      this.animFrameIdx++;

      if (this.animFrameIdx >= this.animDef.frames.length) {
        if (this.animDef.repeat === -1) {
          this.animFrameIdx = 0;
        } else {
          this.animFrameIdx = this.animDef.frames.length - 1;
          this.animationComplete = true;
          this.animationFrame = this.animFrameIdx;
          this.updateSpriteFrame();
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

    // Combat durations are governed by simulation time, never visual callbacks.
    if (state === 'GETTING_UP' || state === 'LANDING') {
      this.combatState.setState('IDLE');
      this.playAnimation('IDLE');
    } else if (state === 'TAUNTING') {
      this.combatState.setState('IDLE');
      this.playAnimation('IDLE');
    }
  }

  // ── Combat ───────────────────────────────────────────────

  /**
   * A grounded attack that already touched the defender may be cancelled into one of the
   * attacks listed in its `cancelsInto`, which is what lets light hits chain into heavy ones.
   */
  canCancelInto(attackName: string): boolean {
    // A light attack still starting may turn into a throw (the second button came a moment late).
    if (attackName === 'THROW' && this.combatState.state === 'ATTACKING' && !this.hasHitThisSwing
      && ['LIGHT_PUNCH', 'LIGHT_KICK'].includes(this.currentAttackDef?.name ?? '')
      && this.combatState.stateTimer <= GAME_CONFIG.GRAB.PRESS_WINDOW_MS) return true;
    // Out of a forward dash, once it has run a little, into a ground attack.
    if (this.combatState.state === 'DASHING' && !this.dashBack && attackName !== 'DASH'
      && this.combatState.stateTimer >= GAME_CONFIG.DASH.FORWARD.ATTACK_CANCEL_MS) return true;
    const current = this.currentAttackDef;
    return this.combatState.state === 'ATTACKING' && this.isGrounded && this.hasHitThisSwing
      && !!current?.cancelsInto?.includes(attackName);
  }

  executeAttack(attackName: string): void {
    if (!this.combatState.canAct() && !this.canCancelInto(attackName)) return;
    if (attackName === 'SPECIAL_ATTACK' && (!this.superReady || !this.isGrounded)) return;

    const driveGrab = attackName === 'SPECIAL_ATTACK' && this.stats.special === 'drive';
    const command = attackName === 'COMMAND_SPECIAL';
    if (command && !this.isGrounded) return;
    // Punches and kicks in the air use the jump-attack data.
    const airborne = !this.isGrounded && ['LIGHT_PUNCH', 'HEAVY_PUNCH', 'LIGHT_KICK', 'HEAVY_KICK'].includes(attackName);
    const baseDef = driveGrab ? DRIVE_GRAB_ATTACK : command ? COMMAND_MOVES[this.stats.commandMove]
      : airborne ? ATTACK_DEFINITIONS[attackName.includes('KICK') ? 'AIR_KICK' : 'AIR_PUNCH'] : ATTACK_DEFINITIONS[attackName];
    if (!baseDef) return;
    if (baseDef.crouch && !this.isGrounded) return;
    const attackDef = this.scaleAttack(baseDef);

    this.currentAttackDef = attackDef;
    this.attackSerial++;
    this.hurtbox.rect = baseDef.crouch ? this.crouchHurtbox : this.standingHurtbox;
    if (this.isGrounded) this.velocityX = 0;
    this.attackStartup = attackDef.startup;
    this.attackActive = attackDef.active;
    this.attackRecovery = attackDef.recovery;
    this.hasHitThisSwing = false;
    this.sonicReleased = false;
    if (attackName === 'SPECIAL_ATTACK') this.energyValue = 0;

    this.combatState.setState('ATTACKING', command ? attackDef.name : attackName);
    const aerial = driveGrab ? 'HEAVY_PUNCH' : attackDef.animation ?? (!this.isGrounded && attackName !== 'SPECIAL_ATTACK'
      ? (attackName.includes('KICK') ? 'AIR_KICK' : 'AIR_PUNCH') : attackName);
    this.playAnimation(this.registry.has(aerial) ? aerial : attackName, true);

    if (attackName === 'SPECIAL_ATTACK' && !driveGrab) { this.hitbox = null; return; }

    // Create hitbox (Hitbox.getWorldRect handles facing direction cleanly without double inversion)
    this.hitbox = new Hitbox(this.characterId, {
      x: attackDef.hitbox.x,
      y: attackDef.hitbox.y,
      width: attackDef.hitbox.width,
      height: attackDef.hitbox.height,
    });
    this.hitbox.active = false;
  }

  protected updateAttackFrames(_delta: number): void {
    if (!this.currentAttackDef) return;
    const { startup, active, recovery } = this.currentAttackDef;
    const elapsedFrames = this.combatState.stateTimer * 60 / 1000;
    if (this.currentAttackDef.name === 'SPECIAL_ATTACK' && this.stats.special === 'sonic' && !this.sonicReleased && elapsedFrames + 1e-6 >= startup) {
      this.sonicReleased = true;
      const direction = this.facingRight ? 1 : -1;
      this.sonicWaves.push(new SonicWave(this.scene, this.x + direction * 65, this.y - 215, direction));
      this.playImpactSound('voice-canto');
    }
    if (elapsedFrames + 1e-6 >= startup + active + recovery) {
      this.endAttack();
      return;
    }
    // Travelling attacks push forward until their active frames end.
    const speed = this.currentAttackDef.forwardSpeed;
    if (speed && this.isGrounded && elapsedFrames < startup + active && !this.hasHitThisSwing) {
      this.velocityX = (this.facingRight ? 1 : -1) * speed;
    }
    if (this.hitbox) this.hitbox.active = !this.hasHitThisSwing && elapsedFrames >= startup && elapsedFrames < startup + active;
  }

  private cancelAttack(): void {
    this.currentAttackDef = null;
    if (this.hitbox) {
      this.hitbox.active = false;
      this.hitbox = null;
    }
    this.attackStartup = 0;
    this.attackActive = 0;
    this.attackRecovery = 0;
    this.hasHitThisSwing = false;
  }

  /** Ends the current attack at once (also used when a throw is broken). */
  endAttack(): void {
    this.cancelAttack();
    this.hurtbox.rect = this.standingHurtbox;
    this.combatState.setState(this.isGrounded ? 'IDLE' : 'JUMPING');
    this.playAnimation(this.isGrounded ? 'IDLE' : 'JUMP');
  }

  /** True while the fighter guards: holding block or still locked in blockstun. */
  get isGuarding(): boolean {
    return this.combatState.state === 'BLOCKING' || this.combatState.state === 'BLOCKSTUN';
  }

  /** Starts a forward dash or a back dash from the ground. Returns whether it started. */
  dash(back: boolean): boolean {
    // A forward dash may also cancel an attack that lists DASH in its cancels.
    const cancel = !back && this.canCancelInto('DASH');
    if ((!this.combatState.canAct() && !cancel) || !this.isGrounded) return false;
    if (cancel) this.cancelAttack();
    this.dashBack = back;
    this.dashSign = (this.facingRight ? 1 : -1) * (back ? -1 : 1);
    this.hurtbox.rect = this.standingHurtbox;
    this.combatState.setState('DASHING');
    this.playAnimation(back ? 'WALK_BACKWARD' : 'DASH', true);
    return true;
  }

  private updateDash(): void {
    if (this.combatState.state !== 'DASHING') return;
    const cfg = this.dashBack ? GAME_CONFIG.DASH.BACK : GAME_CONFIG.DASH.FORWARD, t = this.combatState.stateTimer;
    if (t < cfg.ACTIVE_MS) this.velocityX = this.dashSign * cfg.SPEED;
    else if (t >= cfg.ACTIVE_MS + cfg.RECOVERY_MS) {
      this.combatState.setState('IDLE');
      this.playAnimation('IDLE');
    }
  }

  receiveHit(damage: number, hitstun: number, knockback: number, causesKnockdown: boolean, fromRight: boolean, sonic = false,
    blockstun = 0, blockPushback = 0, launch = false): 'hit' | 'blocked' | 'ignored' {
    if (!this.canReceiveHit) return 'ignored';
    const wasJuggled = this.combatState.state === 'JUGGLED';

    if (this.isGuarding && this.facingRight === fromRight) {
      this.playImpactSound('hit-block');
      this.gainEnergy(8);
      // Chip damage
      this.currentHealth = Math.max(0, this.currentHealth - Math.floor(damage * 0.1));
      if (this.currentHealth === 0) { this.finishRound('DEFEAT'); return 'blocked'; }
      if (blockstun > 0) {
        // The guard holds for the blockstun and the defender slides away from the attacker.
        this.combatState.setState('BLOCKSTUN');
        this.playAnimation('BLOCK');
        this.stunDuration = blockstun * (1000 / 60);
        this.velocityX = (fromRight ? -1 : 1) * blockPushback / this.stats.weight;
      }
      return 'blocked';
    }

    this.cancelAttack();
    this.clearSonicWaves();
    this.gainEnergy(damage + 2);
    this.hurtbox.rect = this.standingHurtbox;
    this.currentHealth = Math.max(0, this.currentHealth - damage);
    this.playImpactSound(damage >= 20 ? 'hit-special' : damage >= 10 ? 'hit-heavy' : 'hit-light');

    const kbDir = fromRight ? -1 : 1;
    knockback /= this.stats.weight;
    this.velocityX = kbDir * knockback;
    if (this.currentHealth <= 0) {
      this.combatState.setState('DEFEAT');
      this.playAnimation('DEFEAT', true);
      this.velocityX = kbDir * (knockback * 0.4);
      return 'hit';
    }

    if (launch || wasJuggled) {
      // Launched, or hit again in the air: up (a smaller pop each time) and still juggled.
      this.juggleHits = launch && !wasJuggled ? 0 : this.juggleHits + 1;
      this.isGrounded = false;
      this.velocityY = -(launch && !wasJuggled ? GAME_CONFIG.JUGGLE.LAUNCH_VELOCITY : GAME_CONFIG.JUGGLE.POP_VELOCITY);
      this.velocityX = kbDir * GAME_CONFIG.JUGGLE.CARRY_SPEED;
      this.combatState.setState('JUGGLED');
      this.playAnimation('HIT_REACTION', true);
    } else if (causesKnockdown) {
      this.knockdown();
    } else {
      this.combatState.setState(sonic ? 'STUNNED' : 'HIT');
      this.playAnimation(sonic ? 'STUN' : 'HIT_REACTION', true);

      this.stunDuration = hitstun * (1000 / 60);
    }
    return 'hit';
  }

  gainEnergy(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0 || this.inSuper || this.currentHealth <= 0) return;
    this.energyValue = Math.min(100, this.energyValue + amount);
  }

  clearSonicWaves(): void {
    this.sonicWaves.forEach(wave => wave.destroy()); this.sonicWaves = [];
  }

  enterSuper(caster: boolean): void {
    this.cancelAttack(); this.clearSonicWaves(); this.stunArt.clear();
    this.velocityX = 0; this.velocityY = 0;
    this.hurtbox.rect = this.standingHurtbox;
    this.combatState.setState(caster ? 'SPECIAL' : 'SUPER_CAUGHT');
    this.playAnimation(caster ? 'SPECIAL_ATTACK' : 'STUN', true);
  }

  takeSuperDamage(damage: number): number {
    if (this.combatState.state !== 'SUPER_CAUGHT') return 0;
    const lost = Math.min(this.currentHealth, Math.max(0, damage));
    this.currentHealth -= lost;
    return lost;
  }

  leaveSuper(caster: boolean, fromRight: boolean): void {
    if (!this.inSuper) return;
    this.sprite.setVisible(true);
    if (caster) { this.endAttack(); return; }
    if (this.currentHealth <= 0) { this.finishRound('DEFEAT'); return; }
    this.combatState.setState('STUNNED'); this.stunDuration = 900;
    this.playAnimation('STUN', true);
    this.velocityX = fromRight ? -180 : 180;
  }

  private knockdown(): void {
    this.combatState.setState('KNOCKED_DOWN');
    this.playAnimation('KNOCKDOWN', true);
    const def = this.registry.get('KNOCKDOWN');
    this.knockdownDuration = (def?.available ? def.frames.length * 1000 / def.frameRate : 500) + 800;
  }

  protected playImpactSound(key: string): void {
    if (this.scene.cache.audio.exists(key)) this.scene.sound.play(key, { volume: 0.65 });
  }

  private getUp(): void {
    if (this.currentHealth <= 0) {
      this.combatState.setState('DEFEAT');
      this.playAnimation('DEFEAT', true);
      return;
    }
    const canAnimate = this.registry.has('GET_UP');
    this.combatState.setState(canAnimate ? 'GETTING_UP' : 'IDLE');
    this.playAnimation(canAnimate ? 'GET_UP' : 'IDLE', true);
  }

  /** Restores health and position for the next round; energy carries over between rounds. */
  resetForRound(x: number): void {
    this.currentHealth = this.maxHealth;
    this.stunDuration = 0;
    this.knockdownDuration = 0;
    this.hitCooldown = 0;
    this.hasHitThisSwing = false;
    this.x = x;
    this.finishRound('IDLE');
  }

  finishRound(state: 'VICTORY' | 'DEFEAT' | 'IDLE'): void {
    this.cancelAttack();
    this.clearSonicWaves();
    this.stunArt.clear();
    this.velocityX = 0;
    this.velocityY = 0;
    this.y = GAME_CONFIG.FLOOR_Y;
    this.isGrounded = true;
    this.jumpsUsed = 0;
    this.hurtbox.rect = this.standingHurtbox;
    this.combatState.setState(state);
    this.playAnimation(state, true);
    this.sprite.setPosition(this.x, this.y);
  }

  // ── Physics ──────────────────────────────────────────────

  applyGravity(delta: number): void {
    if (!this.isGrounded) {
      // Each air hit of a juggle makes the fall faster, so juggles stay short.
      const juggle = this.combatState.state === 'JUGGLED' ? 1 + this.juggleHits * GAME_CONFIG.JUGGLE.GRAVITY_STEP : 1;
      this.velocityY += GAME_CONFIG.GRAVITY * juggle * (delta / 1000);
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
      if (!this.isGrounded && this.combatState.state === 'JUGGLED') {
        // A juggle always ends on the floor.
        this.isGrounded = true;
        this.jumpsUsed = 0;
        this.velocityX = 0;
        this.juggleHits = 0;
        this.knockdown();
      } else if (!this.isGrounded) {
        this.isGrounded = true;
        this.jumpsUsed = 0;
        if (this.combatState.state === 'JUMPING' || this.combatState.state === 'ATTACKING') {
          this.endAttack();
          if (this.registry.has('LANDING')) {
            this.combatState.setState('LANDING');
            this.playAnimation('LANDING', true);
          }
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
      this.velocityX *= Math.pow(0.7, delta / (1000 / 60));
      if (Math.abs(this.velocityX) < 1) this.velocityX = 0;
    }

    this.sprite.setPosition(this.x, this.y);
  }

  jump(): void {
    if (!this.combatState.canAct() || this.jumpsUsed >= GAME_CONFIG.MAX_JUMPS) return;
    this.velocityY = (this.isGrounded ? GAME_CONFIG.JUMP_VELOCITY : GAME_CONFIG.DOUBLE_JUMP_VELOCITY) * this.stats.jumpPower;
    this.jumpsUsed++;
    this.isGrounded = false;
    this.combatState.setState('JUMPING');
    this.playAnimation(this.jumpsUsed === 2 && this.registry.has('DOUBLE_JUMP') ? 'DOUBLE_JUMP' : 'JUMP', true);
  }

  // ── Facing ───────────────────────────────────────────────

  updateFacing(opponentX: number): void {
    if (this.combatState.isLocked()) return;
    const shouldFaceRight = opponentX > this.x;
    if (shouldFaceRight !== this.facingRight) {
      this.facingRight = shouldFaceRight;
      this.sprite.setFlipX(!this.facingRight);
    }
  }

  // ── Update ───────────────────────────────────────────────

  update(delta: number): void {
    if (this.inSuper) { this.updatePresentation(delta); return; }
    this.sonicWaves.forEach(wave => wave.update(delta));
    this.sonicWaves = this.sonicWaves.filter(wave => wave.active);
    this.combatState.tick(delta);
    if (['HIT', 'STUNNED', 'BLOCKSTUN'].includes(this.combatState.state) && this.combatState.stateTimer >= this.stunDuration) {
      this.combatState.setState(this.isGrounded ? 'IDLE' : 'JUMPING');
      this.playAnimation(this.isGrounded ? 'IDLE' : 'JUMP');
    } else if (this.combatState.state === 'KNOCKED_DOWN' && this.combatState.stateTimer >= this.knockdownDuration) {
      this.getUp();
    }
    this.advanceAnimation(delta);
    this.applyGravity(delta);
    this.updateDash();
    this.updateGrab();
    this.updateAttackFrames(delta);
    this.applyMovement(delta);
    this.stunArt.clear();
    if (this.currentAttackDef?.name === 'SPECIAL_ATTACK' && !this.sonicReleased) {
      const charge = Math.min(1, this.combatState.stateTimer / 350);
      this.stunArt.lineStyle(3, 0xf5bd75, 0.8).strokeCircle(this.x, this.y - 140, 40 + charge * 55);
      this.stunArt.lineStyle(2, 0x9fe8e1, 0.8).strokeCircle(this.x, this.y - 140, 28 + charge * 42);
    }
    if (this.combatState.state === 'STUNNED') {
      for (let i = 0; i < 3; i++) {
        const angle = this.combatState.stateTimer * 0.006 + i * Math.PI * 2 / 3;
        this.stunArt.fillStyle(0xffe49a, 1);
        this.stunArt.fillCircle(this.x + Math.cos(angle) * 32, this.y - 265 + Math.sin(angle) * 9, 4);
      }
    }
    this.drawDebug();
  }

  updatePresentation(delta: number): void {
    // Sustain the open-mouth singing drawings instead of replaying wind-up and recovery.
    if (this.combatState.state === 'SPECIAL' && this.stats.special === 'sonic' && this.animDef?.impactStart !== undefined && this.animDef.impactEnd !== undefined) {
      this.animTimer += delta;
      const start = this.animDef.impactStart, count = this.animDef.impactEnd - start;
      this.animFrameIdx = start + Math.floor(this.animTimer / 85) % Math.max(1, count);
      this.animationFrame = this.animFrameIdx; this.updateSpriteFrame();
    } else this.advanceAnimation(delta);
    if (this.inSuper && this.animationComplete) this.playAnimation(this.combatState.getAnimationName(), true);
    this.drawDebug();
  }

  // ── Debug ────────────────────────────────────────────────

  private drawDebug(): void {
    this.debugGraphics?.clear();
    if (!GAME_CONFIG.DEBUG_MODE || !this.debugGraphics) return;

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
      'Energy': `${this.energy}/100`,
      'Grounded': this.isGrounded ? 'YES' : 'NO',
    };
  }

  destroy(): void {
    this.sonicWaves.forEach(wave => wave.destroy());
    this.stunArt?.destroy();
    this.sprite?.destroy();
    this.debugGraphics?.destroy();
  }
}
