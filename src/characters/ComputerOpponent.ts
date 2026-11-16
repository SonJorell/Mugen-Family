import { Fighter, FighterOptions } from './Fighter';
import { CpuDifficulty, CpuProfile, GAME_CONFIG } from '../config/gameConfig';
import { COMMAND_MOVES } from '../combat/AttackDefinition';
import { makeRandom } from '../utils/Random';

const ATTACKS = ['LIGHT_PUNCH', 'LIGHT_KICK', 'HEAVY_PUNCH', 'HEAVY_KICK'] as const;

export interface CpuOptions {
  difficulty?: CpuDifficulty;
  /** Fixes the CPU's random choices (tests); omitted in normal play. */
  seed?: number;
}

/** A sparring partner whose reactions, guard and aggression follow its difficulty profile. */
export class ComputerOpponent extends Fighter {
  readonly difficulty: CpuDifficulty;
  private readonly profile: CpuProfile;
  private readonly random: () => number;
  private decisionTimer = 0;
  private attackCooldown = 600;
  private jumpCooldown = 1800;
  /** Each incoming attack, jump-in and recovery is judged once, so faster thinking adds no free rolls. */
  private judgedAttack = -1;
  private judgedJump = false;
  private judgedRecovery = false;
  private judgedCombo = -1;

  constructor(opts: FighterOptions, cpu: CpuOptions = {}) {
    super(opts);
    this.difficulty = cpu.difficulty ?? GAME_CONFIG.DEFAULT_CPU_DIFFICULTY;
    this.profile = GAME_CONFIG.CPU_DIFFICULTY[this.difficulty];
    this.random = makeRandom(cpu.seed);
  }

  private chance(p: number): boolean { return p > 0 && this.random() < p; }

  private pickAttack(): string {
    const weights = this.profile.attacks, total = weights.reduce((a, b) => a + b, 0);
    let roll = this.random() * total;
    for (let i = 0; i < ATTACKS.length; i++) { roll -= weights[i]; if (roll < 0) return ATTACKS[i]; }
    return ATTACKS[0];
  }

  private nextCooldown(): number {
    const [min, max] = this.profile.attackCooldownMs;
    return min + (max - min) * this.random();
  }

  think(delta: number, target: Fighter): void {
    this.decisionTimer -= delta;
    this.attackCooldown -= delta;
    this.jumpCooldown -= delta;
    const targetAttack = target.getActiveAttackDef();
    if (target.isGrounded) this.judgedJump = false;
    const recovering = !!targetAttack && target.combatState.stateTimer * 60 / 1000 >= targetAttack.startup + targetAttack.active;
    if (!recovering) this.judgedRecovery = false;
    // Combo: a light hit that connected may be cancelled into a heavy one, once per swing.
    if (this.judgedCombo !== this.attackSerial && ['HIT', 'STUNNED'].includes(target.combatState.state)
      && this.canCancelInto('HEAVY_PUNCH')) {
      this.judgedCombo = this.attackSerial;
      if (this.chance(this.profile.comboChance)) { this.executeAttack('HEAVY_PUNCH'); return; }
    }
    // Heavy that connected → command special, half as often as light → heavy.
    if (this.judgedCombo !== this.attackSerial && ['HIT', 'STUNNED'].includes(target.combatState.state)
      && this.canCancelInto('COMMAND_SPECIAL') && !this.canCancelInto('HEAVY_PUNCH')) {
      this.judgedCombo = this.attackSerial;
      if (this.chance(this.profile.comboChance * 0.5)) { this.executeAttack('COMMAND_SPECIAL'); return; }
    }
    if (!this.combatState.canAct() || this.decisionTimer > 0) return;
    this.decisionTimer = this.profile.reactionMs;
    // Keep the original direction in the air so crossing over does not turn into orbiting.
    if (!this.isGrounded) {
      if (this.velocityY >= -80) this.jump();
      return;
    }
    this.updateFacing(target.x);
    const distance = Math.abs(target.x - this.x);
    const busy = ['KNOCKED_DOWN', 'GETTING_UP'].includes(target.combatState.state);

    // Punish: an attack already in recovery cannot be turned into a block in time.
    if (recovering && !this.judgedRecovery && distance < 150 && !busy) {
      this.judgedRecovery = true;
      if (this.chance(this.profile.punishChance)) { this.strike('LIGHT_PUNCH'); return; }
    }
    // Anti-air: a close jump-in meets a rising heavy punch.
    if (!target.isGrounded && !this.judgedJump && distance < 200) {
      this.judgedJump = true;
      if (this.chance(this.profile.antiAirChance)) { this.strike('HEAVY_PUNCH'); return; }
    }
    // Guard against an attack that is still coming.
    if (targetAttack && !recovering && distance < 190) {
      if (this.judgedAttack !== target.attackSerial) {
        this.judgedAttack = target.attackSerial;
        if (this.chance(this.profile.blockChance)) {
          this.velocityX = 0;
          this.combatState.setState('BLOCKING');
          this.playAnimation('BLOCK');
          return;
        }
        // Otherwise it may slip out with a back dash (invulnerable at the start).
        if (this.chance(this.profile.backdashChance) && this.dash(true)) return;
      } else if (this.combatState.state === 'BLOCKING') return;
    }
    // Command special when the rival stands in its range.
    const [near, far] = COMMAND_MOVES[this.stats.commandMove].cpuRange ?? [0, 0];
    if (this.attackCooldown <= 0 && !busy && distance >= near && distance <= far && this.chance(this.profile.commandChance)) {
      this.strike('COMMAND_SPECIAL');
      return;
    }
    if (this.jumpCooldown <= 0 && distance > 60 && distance < 230) {
      this.velocityX = (this.facingRight ? 1 : -1) * this.walkSpeed;
      this.jump();
      this.jumpCooldown = this.profile.jumpCooldownMs;
      return;
    }
    // A sweep from up close now and then.
    if (this.attackCooldown <= 0 && !busy && distance < 140 && this.chance(this.profile.sweepChance)) {
      this.strike('SWEEP');
      return;
    }
    // Close the gap quickly from far away.
    if (distance > 320 && this.chance(this.profile.dashChance) && this.dash(false)) return;
    if (distance > 125) {
      this.combatState.setState('WALKING_FORWARD');
      this.playAnimation('WALK_FORWARD');
    } else if (this.attackCooldown <= 0 && !busy) {
      this.strike(this.superReady ? 'SPECIAL_ATTACK' : this.pickAttack());
      return;
    } else {
      this.combatState.setState('IDLE');
      this.playAnimation('IDLE');
    }
    this.velocityX = 0;
  }

  private strike(attack: string): void {
    this.combatState.setState('IDLE');
    this.velocityX = 0;
    this.executeAttack(attack);
    this.attackCooldown = this.nextCooldown();
  }

  override update(delta: number): void {
    if (this.combatState.state === 'WALKING_FORWARD') {
      this.velocityX = (this.facingRight ? 1 : -1) * this.walkSpeed * 0.8;
    }
    super.update(delta);
  }
}
