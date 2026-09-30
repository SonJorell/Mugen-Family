# Mugen Family 🥊

A professional 2D arcade fighting web game built with Phaser 3 + TypeScript + Vite, inspired by classic MUGEN fighters.

## ⚡ Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## 🎮 Controls

| Action        | Key              |
|---------------|------------------|
| Move Left     | `A` / `←`        |
| Move Right    | `D` / `→`        |
| Jump          | `W` / `↑`        |
| Crouch        | `S` / `↓`        |
| Light Punch   | `J`              |
| Heavy Punch   | `K`              |
| Light Kick    | `U`              |
| Heavy Kick    | `I`              |
| Block         | `L`              |
| Special       | `O`              |
| Taunt         | `P`              |
| Pause         | `ESC`            |
| Toggle Debug  | `F1`             |

## 🕹️ Training Mode Controls

| Action       | Key          |
|--------------|--------------|
| Cycle Anim   | `← / →`      |
| Animation 1  | `1` = IDLE   |
| Animation 2  | `2` = WALK_FORWARD |
| Animation 3  | `3` = WALK_BACKWARD |
| ...etc       | `4-0`        |
| Flip         | `A`          |
| Back to Menu | `ESC`        |

## 📁 Project Structure

```
src/
├── config/         # Game constants & config
├── scenes/         # Phaser scenes
├── characters/     # Fighter classes
├── animation/      # Sprite loader & registry
├── combat/         # Hitboxes, state machine, attacks
├── input/          # Input manager
├── systems/        # Facing, round, physics
├── ui/             # HUD, health bars, messages
└── utils/          # Asset utils, debug helpers
```

## 🖼️ Adding New Animations

1. Create folder: `public/assets/characters/tilin/NEW_ANIM/`
2. Add files: `NEW_ANIM_1.JPG`, `NEW_ANIM_2.JPG`, etc.
3. Each file contains **exactly 3 frames** horizontally
4. Add entry to `manifest.json`
5. No engine changes needed!

## 🔧 Debug Mode

Press `F1` to toggle debug mode which shows:
- Current animation & frame
- Fighter state & position
- Hitboxes (red) and hurtboxes (green)
- Anchor point (yellow dot)
- FPS counter

## 🏗️ Build

```bash
npm run build
```
