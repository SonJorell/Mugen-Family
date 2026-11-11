// Simulates Tilin vs César with the CPU driving both sides, to check the roster balance.
// Usage (dev server running): node scripts/simulate-balance.mjs [rounds-per-side] [difficulty]
// Each round starts from full health; sides are swapped so the left/right start does not bias it.
import { chromium } from '@playwright/test';

const ROUNDS = Number(process.argv[2] ?? 30);
const DIFFICULTIES = process.argv[3] ? [process.argv[3]] : ['normal', 'hard'];
const URL = process.env.GAME_URL ?? 'http://127.0.0.1:3000';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
});
await page.goto(URL);
await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 30000 });

const results = [];
for (const difficulty of DIFFICULTIES) {
  for (const [left, right] of [['tilin', 'cesar'], ['cesar', 'tilin']]) {
    await page.evaluate(({ left, right, difficulty }) => {
      const game = window.__game;
      if (!game.loop.running) game.loop.start(game.loop.callback);
      game.scene.getScenes(true).forEach(s => game.scene.stop(s.scene.key));
      game.scene.start('FightScene', { mode: 'cpu', difficulty, cpuSeed: 11,
        playerChoice: { characterId: left, paletteId: 'original' }, opponentChoice: { characterId: right, paletteId: 'amethyst' } });
    }, { left, right, difficulty });
    await page.waitForFunction(() => window.__game.scene.getScene('FightScene').roundSystem?.phase === 'FIGHT', null, { timeout: 20000 });
    const batch = await page.evaluate(({ rounds, difficulty }) => {
      const game = window.__game, s = game.scene.getScene('FightScene');
      game.loop.stop();
      // Put a CPU in the player's place, built like the scene builds the rival.
      const Cpu = s.opponent.constructor, human = s.player;
      const cpu = new Cpu({ scene: s, registry: s.registry2, loader: s.loader, characterId: human.characterId, x: human.x, y: human.y,
        maxHealth: human.maxHealth, scale: human.scale / human.stats.size, stats: human.stats }, { difficulty, seed: 29 });
      human.destroy();
      s.player = cpu;
      const out = [];
      const dt = 1000 / 60, startL = 1920 * 0.35, startR = 1920 * 0.65;
      for (let r = 0; r < rounds; r++) {
        let winner = null, reason = null;
        s.roundSystem.onRoundEnd = (w, why) => { winner = w; reason = why; };
        s.superMove.cancel(); s.hitstopMs = 0; s.combos.reset();
        for (const [f, x] of [[s.player, startL], [s.opponent, startR]]) { f.resetForRound(x); f.energyValue = 0; }
        Object.assign(s.roundSystem, { _phase: 'FIGHT', _timeLeft: 99, _timerRunning: true });
        let frames = 0;
        while (!winner && frames < 99 * 60 + 600) { s.player.think(dt, s.opponent); s.update(0, dt); frames++; }
        const pct = f => Math.round(f.currentHealth / f.maxHealth * 100);
        out.push({ winner, reason, seconds: Math.round(frames / 60), left: pct(s.player), right: pct(s.opponent) });
      }
      return out;
    }, { rounds: ROUNDS, difficulty });
    for (const r of batch) {
      const winnerId = r.winner === 'player' ? left : r.winner === 'opponent' ? right : 'draw';
      results.push({ difficulty, winner: winnerId, reason: r.reason, seconds: r.seconds,
        hp: { [left]: r.left, [right]: r.right } });
    }
  }
}
await browser.close();

for (const difficulty of DIFFICULTIES) {
  const rows = results.filter(r => r.difficulty === difficulty);
  const wins = id => rows.filter(r => r.winner === id).length;
  const avg = list => list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0;
  const winnerHp = id => avg(rows.filter(r => r.winner === id).map(r => r.hp[id]));
  console.log(`\n${difficulty.toUpperCase()} · ${rows.length} rounds`);
  console.log(`  Tilin: ${wins('tilin')} wins (${Math.round(wins('tilin') / rows.length * 100)} %), health left when winning ${winnerHp('tilin')} %`);
  console.log(`  César: ${wins('cesar')} wins (${Math.round(wins('cesar') / rows.length * 100)} %), health left when winning ${winnerHp('cesar')} %`);
  console.log(`  Draws: ${wins('draw')} · K.O.: ${rows.filter(r => r.reason === 'ko').length} · average ${avg(rows.map(r => r.seconds))} s`);
}
if (errors.length) { console.error('\nPage errors:', errors); process.exitCode = 1; }
