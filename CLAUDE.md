# CLAUDE.md — Mugen Family (mugen-web-fighter)

Guía para cualquier sesión de Claude Code que trabaje en este juego. Adapta, sin copiar el
framework completo, las reglas útiles de Claude-Code-Game-Studios (MIT) a este proyecto.

## Qué es

Juego de pelea 2D para navegador. Phaser 3 (3.87), TypeScript, Vite, pruebas Playwright.
Plantel actual: Tilin, César, Joako, Jorell y Tata (escala real por estatura en `FIGHTER_HEIGHT_CM`).
Escenarios en `GAME_CONFIG.STAGES`. Público: jugador de teclado, mando o pantalla táctil.

## Comandos

```sh
npm ci            # instalar
npm run dev       # http://localhost:3000
npm run check     # tsc --noEmit (tipado)
npm run lint      # ESLint + typescript-eslint
npm test          # Playwright sobre el juego real
npm run build     # tsc + vite build
```

Antes de dar un cambio por terminado: `npm run check`, `npm run lint` y las pruebas del área tocada
(`npx playwright test tests/<archivo>.spec.ts`). La suite completa, una vez antes de integrar.

## Mapa del código (`src/`)

| Carpeta | Responsabilidad |
| --- | --- |
| `config/` | Datos: `gameConfig.ts` (física, tiempos, escenarios), `roster.ts` (luchadores y `FighterStats`), `characters.ts` (manifiestos y carga) |
| `combat/` | Datos y reglas de golpes: `AttackDefinition.ts` (frames, daño, hitbox), colisiones, `CombatState`, súper y proyectiles |
| `characters/` | `Fighter` (estado y física por luchador), jugador, CPU, muñeco de práctica |
| `systems/` | Sistemas transversales: rounds, físicas, orientación, audio, controlador |
| `input/` | Teclado y mapeo (`InputMapping.ts`) |
| `scenes/` | Flujo de pantallas: Boot → Preload → Menu → Selection → Fight (+ Pause, Settings, galería) |
| `ui/` | HUD, barras, temporizador, efectos de menú y selección |

## Reglas de código de gameplay

1. **Datos fuera de la lógica.** Daño, frames, velocidades y multiplicadores viven en `config/`
   o en `combat/AttackDefinition.ts`. No escribir números de balance dentro de `Fighter` o de
   las escenas. Un luchador nuevo se agrega en `roster.ts` + su `manifest.json`, sin tocar
   la lógica.
2. **Tiempo con delta.** Todo lo que dependa del tiempo usa `delta` o frames convertidos a ms,
   nunca la cantidad de llamadas a `update`.
3. **Estados explícitos.** Las transiciones de `CombatState` se hacen solo con `setState`.
   Un estado nuevo se documenta en `CombatState.ts` con desde dónde se entra y cómo se sale.
4. **La lógica no dibuja la interfaz.** `combat/`, `characters/` y `systems/` avisan con
   callbacks o eventos (como `RoundSystem.onRoundEnd`); el HUD los escucha.
5. **Ambos lados iguales.** Toda mecánica nueva funciona igual para jugador y CPU, y con
   cualquier luchador del plantel (pruébala con Tilin y con César).
6. **Instrumentación solo en pruebas.** Nada de código de depuración en la app, salvo lo que
   ya cuelga de F1 / `DEBUG_MODE`.
7. **Phaser 3, no 4.** No actualizar Phaser sin una decisión registrada: Phaser 4 elimina
   pipelines, `preFX/postFX`, `setTintFill` y `Geom.Point`, que el código puede usar.

## Reglas de pruebas

- Cada mecánica de combate nueva lleva al menos una prueba Playwright que la ejerza en una
  pelea real (golpe que conecta, bloqueado, fallado).
- No desactivar ni saltar pruebas para pasar en verde.
- Las capturas y resultados van a `artifacts/` y `test-results/`, que están en `.gitignore`.

## Flujo de trabajo

- Ramas: `main` estable; `feature/<tema>` para cada ticket de `docs/BACKLOG.md`.
- Commits semánticos: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Un ticket por rama; cerrar el ticket en `docs/BACKLOG.md` en el mismo cambio.
- Decisiones de arquitectura (motor, formato de datos, red) se anotan en
  `docs/DECISIONES.md` con fecha, contexto, opción elegida y motivo.
- Assets: originales de alta resolución fuera de `public/`; en `public/assets/` solo lo que
  el juego carga. Cada arte generado guarda su prompt y procedencia en `art/<tema>/`.
