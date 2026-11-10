# Backlog — Mugen Family

Tickets pequeños (1–2 días). Origen: la lista de control del género de peleas de
Claude-Code-Game-Studios, contrastada con el código actual (noviembre 2026).
Estado: `[ ]` pendiente · `[~]` en curso · `[x]` terminado.

## MVP de mejoras de combate (prioridad alta)

### [x] PEL-01 · Combate al mejor de 3 rounds
- **Hoy:** `RoundSystem` ya cuenta `_round`, pero la partida termina tras un round
  (99 s, K.O. o tiempo).
- **Hacer:** `ROUNDS_TO_WIN: 2` en `gameConfig.ts`; al terminar un round, reiniciar vida y
  posiciones y empezar el siguiente; mostrar rounds ganados en el HUD; el empate no suma.
- **Terminado cuando:** una prueba Playwright gana 2 rounds y ve la pantalla de victoria;
  otra comprueba que un empate no da round a nadie.

### [x] PEL-02 · Búfer de entradas
- **Hoy:** `InputManager` usa `JustDown`; un golpe pulsado mientras termina el anterior se
  pierde.
- **Hacer:** guardar la última pulsación de ataque durante `INPUT_BUFFER_MS` (≈100 ms, en
  `gameConfig.ts`) y ejecutarla en cuanto el luchador pueda actuar.
- **Terminado cuando:** una prueba pulsa J durante la recuperación de K y el puño suave sale
  al terminar, una sola vez.

### [x] PEL-03 · Bloqueo con consecuencia (blockstun y empuje)
- **Hoy:** `Fighter.receiveHit` al bloquear solo resta 10 % de daño; no hay empuje ni
  aturdimiento de guardia, y un golpe fuerte bloqueado no deja al atacante expuesto.
- **Hacer:** agregar `blockstun` y `blockPushback` a `AttackDefinition`; el que bloquea retrocede
  y queda unos frames en guardia; los golpes fuertes quedan en desventaja al ser bloqueados.
- **Terminado cuando:** pruebas verifican el empuje y que tras bloquear un HEAVY_KICK el
  defensor puede golpear antes de que el atacante se recupere.
- **Hecho:** estado `BLOCKSTUN` (bloqueado, sigue protegiendo); golpes suaves −1/−2 frames y
  fuertes −10/−11 al ser bloqueados. Pruebas en `tests/block.spec.ts` con Tilin y César en
  ambos lados.

### [x] PEL-05 · Sensación de impacto (hitstop, sacudida y chispas)
- **Hacer:** congelar a ambos luchadores 50–120 ms al conectar según la fuerza del golpe;
  sacudida leve de cámara en golpes fuertes; chispas distintas para golpe y bloqueo. Valores
  en `GAME_CONFIG.HIT_FEEL`. Con *Reducir movimiento* no hay sacudida y las chispas no se mueven.
- **Terminado cuando:** pruebas verifican la congelación, que el reloj del round sigue corriendo,
  que el súper limpia el hitstop y que *Reducir movimiento* no sacude la cámara.
- **Hecho:** `FighterController.onImpact` → `FightScene` (hitstop) y `ui/ImpactEffects.ts`.
  Pruebas en `tests/hitfeel.spec.ts`.

### [x] PEL-06 · Contador de combos y cancelación de golpes suaves
- **Hoy:** un golpe suave deja al atacante en −2: no existen combos.
- **Hacer:** `cancelsInto` en `AttackDefinition` (puño suave → patada suave, puño o patada
  fuertes; patada suave → fuertes), solo en el suelo y tras tocar al rival; contador «N HITS»
  con daño total mientras el rival sigue aturdido; la CPU encadena según su dificultad.
- **Terminado cuando:** pruebas verifican el combo de 2 y de 3 golpes (también con César), que
  no se cancela al fallar ni de fuerte a suave, que el contador desaparece y que la CPU Difícil
  encadena.
- **Hecho:** `systems/ComboTracker.ts`, `ui/ComboDisplay.ts`, `GAME_CONFIG.COMBO`,
  `comboChance` por dificultad. Pruebas en `tests/combo.spec.ts`.

### [x] PEL-04 · Lista de movimientos en la pausa
- **Hoy:** `PauseScene` no muestra controles.
- **Hacer:** opción "Movimientos" que lista teclas por luchador (leídas de `InputMapping.ts` y
  `roster.ts`, no escritas a mano).
- **Terminado cuando:** se abre desde la pausa con teclado, muestra el poder correcto de Tilin
  y de César y vuelve con Esc.
- **Hecho:** `MOVE_LIST` y `describeKeys` en `InputMapping.ts`; quinta opción de la pausa.
  Prueba en `tests/movelist.spec.ts`.

## Funcionalidades nuevas

### [x] FUN-01 · Dificultad de la CPU
- **Hoy:** `ComputerOpponent` rota los 4 golpes en orden fijo, bloquea 1 de cada 3 y no se
  agacha ni responde a saltos.
- **Hacer:** niveles Fácil / Normal / Difícil (tiempos de reacción, probabilidad de bloqueo,
  anti-aéreo) en datos de `gameConfig.ts`; selector en la selección de luchadores; algo de azar.
- **Terminado cuando:** cada nivel se elige con teclado y una prueba verifica que Difícil
  bloquea más que Fácil en el mismo escenario.
- **Hecho:** `GAME_CONFIG.CPU_DIFFICULTY` (reacción, bloqueo, pausa entre ataques, anti-aéreo,
  castigo, saltos y pesos de golpes); tecla X o botón «CPU: …» en la selección; semilla
  inyectable (`cpuSeed`) para pruebas en `utils/Random.ts`. Pruebas en `tests/difficulty.spec.ts`.

### [ ] FUN-02 · Dos jugadores locales (teclado compartido y gamepad)
- **Hacer:** segundo juego de teclas y soporte de mando con el plugin de gamepad de Phaser;
  modo "Jugador 2" en el selector.
- **Terminado cuando:** dos jugadores pelean un combate completo; prueba con entradas simuladas.

### [ ] FUN-03 · Reasignar teclas en Configuración
- **Hacer:** fila "Controles" en `SettingsScene`; guardar en `localStorage`; botón restaurar.
- **Terminado cuando:** una tecla cambiada funciona en combate y persiste al recargar.

### [ ] FUN-04 · Modo arcade
- **Hacer:** escalera contra cada rival del plantel con dificultad creciente y pantalla final
  por luchador.
- **Terminado cuando:** se puede completar la escalera y ver el final.

### [ ] FUN-05 · Modo entrenamiento mejorado
- **Hacer:** visor de entradas, datos de frames del último golpe y vida que se recupera.
- **Terminado cuando:** las tres opciones se activan desde la pausa del modo práctica.

### [ ] FUN-06 · Publicación web
- **Hacer:** script de despliegue de `dist/` a itch.io o GitHub Pages (ruta base de Vite).
- **Terminado cuando:** el juego abre desde un link público.

## Calidad y proceso

### [ ] CAL-04 · Limpiar versiones viejas de sprites
- **Hoy:** en `public/assets/characters` conviven `tilin`, `tilin-v2`, `tilin-v3`, `cesar` y
  `cesar-v2`.
- **Hacer:** verificar qué carga cada `manifest.json` y mover lo no usado fuera de `public/`.
- **Terminado cuando:** el build pesa menos y todas las pruebas pasan.


### [x] CAL-01 · Linter y formato
- Agregar ESLint (typescript-eslint) y un script `npm run lint`; corregir lo que marque.
- **Terminado cuando:** `npm run lint` pasa sin errores.
- **Hecho:** `eslint.config.js` (flat config, reglas recomendadas de ESLint y typescript-eslint;
  `any` permitido solo en pruebas). Se corrigieron 8 importaciones y parámetros sin uso.

### [ ] CAL-02 · Revisión de balance Tilin vs César
- Tabla con daño por golpe × `damage`, frames × `attackSpeed`, vida y alcance de cada uno;
  calcular cuántos golpes de cada tipo necesita cada luchador para ganar.
- **Terminado cuando:** la tabla está en `docs/BALANCE.md` y los ajustes acordados están en
  `roster.ts` / `AttackDefinition.ts`.

### [ ] CAL-03 · Registro de decisiones
- Crear `docs/DECISIONES.md` con las decisiones ya tomadas (Phaser 3, sprites con chroma key,
  plantel por manifiesto, audio sintetizado).

## Trabajo futuro (no MVP)

- Modo entrenamiento con visor de entradas.
- Medidor de súper visible y reglas de gasto.
- Escalera arcade contra varios rivales.
- Segundo jugador en el mismo teclado o con gamepad.
- Controles táctiles.
- Combos largos, cancelaciones y juggles.
- Multijugador en línea (requiere servidor).
