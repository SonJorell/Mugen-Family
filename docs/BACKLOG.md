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

### [x] PEL-11 · Agarre
- **Hacer:** puño suave + patada suave de cerca, rompe la guardia, se escapa pulsando lo mismo en
  una ventana corta; animaciones existentes.
- **Terminado cuando:** pruebas verifican el agarre a un rival que bloquea, la tolerancia entre
  botones, el fallo de lejos, que no se puede agarrar a un rival aturdido, el escape a tiempo y
  tarde, y la CPU.
- **Hecho:** `THROW` en `AttackDefinition.ts` (13 de daño, derriba); estado `GRABBED`;
  `GAME_CONFIG.GRAB` (60 ms entre botones, 250 ms para escapar); `throwChance` y `techChance` en
  la CPU. Pruebas en `tests/grab.spec.ts`.

### [x] PEL-10 · Sistema de combos completo
- **Hacer:** rutas de cancelación suave → suave (un paso) → fuerte → especial → súper solo al
  conectar; ataques agachado (el fuerte como barrido); ataques aéreos que enlazan al aterrizar;
  lanzador y juggle acotado; escalado de daño y tope; dash cancel; la CPU usa las rutas nuevas.
- **Terminado cuando:** pruebas verifican cada ruta, que no hay cancelación al fallar ni bucles de
  golpes suaves, el juggle con su límite, el escalado, el tope del 45 % con un intento de bucle
  infinito, el dash cancel y la CPU.
- **Hecho:** `cancelsInto` completo en `AttackDefinition.ts`; nuevos `CROUCH_LIGHT` (↓ + suave),
  `LAUNCHER` (↓ + puño fuerte), `SWEEP` (↓ + patada fuerte), `AIR_PUNCH` y `AIR_KICK`; estado
  `JUGGLED`; `GAME_CONFIG.COMBO` (2 golpes enteros, −15 % por golpe hasta 30 %, 8 golpes, 45 %)
  y `GAME_CONFIG.JUGGLE` (3 golpes en el aire, gravedad +35 % por golpe); dash cancel desde el
  puño fuerte y ataque desde el dash adelante tras 100 ms; `sweepChance` en la CPU. Pruebas en
  `tests/combos.spec.ts`.

### [x] PEL-09 · Dash y dash atrás
- **Hacer:** doble toque adelante/atrás, tecla de dash reasignable para J1 y J2, botón de mando y
  táctil; el dash atrás con invulnerabilidad inicial y recuperación castigable; la CPU lo usa.
- **Terminado cuando:** pruebas verifican el doble toque (y que caminar o el comando ↓ → + puño no
  lo disparan), la invulnerabilidad y el castigo, la tecla de ambos jugadores, el mando, el táctil
  y la CPU.
- **Hecho:** estado `DASHING` y `Fighter.dash`; `GAME_CONFIG.DASH` (ventana de doble toque,
  velocidad, duración, invulnerabilidad y recuperación); tecla DASH (Espacio / Retroceso o Num +)
  en Controles; LB en el mando (provocar pasa a Back); botón DS y doble toque en el táctil;
  `dashChance` y `backdashChance` por dificultad. Pruebas en `tests/dash.spec.ts` y
  `tests/touch.spec.ts`.
- **Fuera:** dash aéreo y carrera al mantener adelante (ver DECISIONES).

### [x] PEL-08 · Segundo especial con comando
- **Hacer:** ↓ ↘ → + puño, con tolerancia en `gameConfig`; un movimiento por luchador con
  animaciones existentes; la CPU también lo usa; en la lista de movimientos y en `BALANCE.md`.
- **Terminado cuando:** pruebas verifican el comando (y que uno lento no sale), el efecto de cada
  luchador, la cancelación desde un golpe suave, la CPU y el teclado real.
- **Hecho:** `COMMAND_MOVES` en `AttackDefinition.ts` (Tilin: «Paso veloz», avance con golpe con la
  animación DASH; César: «Pisotón sísmico», pisotón bajo que derriba con HEAVY_KICK);
  `FighterStats.commandMove`; detección en `PlayerFighter` con `GAME_CONFIG.COMMAND`;
  `commandChance` por dificultad. Pruebas en `tests/command.spec.ts`.

### [x] FUN-07 · Controles táctiles
- **Hacer:** botones en pantalla solo en dispositivos táctiles, sin tapar el HUD.
- **Terminado cuando:** una prueba con emulación táctil mueve, salta y ataca, incluso con dos dedos.
- **Hecho:** `ui/TouchControls.ts` (cruceta abajo a la izquierda; PS, PF, SP, KS, KF, BL abajo a la
  derecha; posiciones en `GAME_CONFIG.TOUCH`). Cada cuadro asigna cada dedo al botón que tiene
  debajo (se puede deslizar y usar varios a la vez). Una tecla los oculta y el siguiente toque los
  muestra; con ellos visibles se oculta el pie de teclas. Solo para el jugador 1. Pruebas en
  `tests/touch.spec.ts` (eventos táctiles reales de Chromium).

### [x] FUN-08 · Volumen de efectos y estadísticas guardadas
- **Hacer:** volumen propio para los efectos en Configuración; estadísticas en `localStorage`
  (victorias, derrotas, mejor combo, arcade completado) visibles desde el menú.
- **Terminado cuando:** pruebas verifican el volumen de efectos (sin afectar la música) y que los
  combates, el combo y el arcade quedan guardados y se ven en la pantalla.
- **Hecho:** «Volumen de efectos» en Configuración (`GameAudio.sfxVolume`); `systems/Stats.ts`
  (`fighter-stats`) y `StatsScene` (quinta opción del menú, Supr dos veces para borrar). Los
  combates de práctica no cuentan; los de dos jugadores van aparte. Pruebas en
  `tests/stats.spec.ts`.

### [x] PEL-07 · Locutor y frases de victoria
- **Hacer:** voces sintetizadas por script para «Round N», «¡Pelea!», «K.O.», «¡Tiempo!» y el
  veredicto, con volumen propio; frase de victoria por luchador al ganar el combate.
- **Terminado cuando:** pruebas verifican que suena cada línea en su momento, la frase del ganador
  y el volumen del locutor.
- **Hecho:** `scripts/generate-announcer.mjs` (sintetizador de formantes, sin grabaciones ni TTS)
  genera 13 WAV; `systems/Announcer.ts`; `RoundSystem` y `FightMessages` llaman al locutor;
  `victoryQuote` en `roster.ts`; «Volumen del locutor» en Configuración (`GameAudio` aplica el
  volumen por categoría en un solo lugar). Pruebas en `tests/announcer.spec.ts`.

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

### [x] CAL-05 · Carga más rápida
- **Hoy:** el juego descarga 95,4 MB al arrancar (≈ 45 s a 20 Mbit/s); la barra de carga se
  reinicia entre fases y dice «MUGEN WEB FIGHTER».
- **Hacer:** pantalla de carga con progreso real y aligerar las imágenes que el juego carga, sin
  borrar los originales ni cambiar el recorte.
- **Terminado cuando:** se midió antes y después, el recorte de los 552 cuadros es idéntico y las
  pruebas pasan.
- **Hecho:** `ui/LoadingScreen.ts` (progreso por archivos en dos fases que solo avanza, qué se
  carga y un consejo); `scripts/convert-webp.py` genera `.webp` junto a 57 imágenes (80 → 18,9 MB);
  `scripts/measure-load.mjs` mide peso y tiempo. Resultado: 95,4 → 37,1 MB y 45,5 → 21,0 s hasta el
  menú a 20 Mbit/s. Pruebas en `tests/loading.spec.ts`.

## Audio

### [x] AUD-01 · Música del menú aportada
- **Hacer:** «Cinturão de Elite» (MP3 aportado por Jorell) como música del menú en bucle; el
  combate conserva su pista; selector «Música del menú» en Configuración; carga en segundo plano.
- **Terminado cuando:** pruebas verifican que suena en el menú en bucle, respeta volumen y M, el
  combate usa su pista y el selector cambia y se recuerda.
- **Hecho:** `GAME_CONFIG.MENU_MUSIC` (bucle 0,09–174,9 s, sin los silencios de los extremos);
  `GameAudio` la carga tras abrir el menú y la reproduce con un marcador en bucle; si falla, suena
  la pista original. Créditos con la nota de licencia. Pruebas en `tests/menu-music.spec.ts`.
- **Pendiente:** confirmar la licencia de la canción antes de publicar el juego.

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

### [x] FUN-02 · Dos jugadores locales (teclado compartido y gamepad)
- **Hacer:** segundo juego de teclas y soporte de mando con el plugin de gamepad de Phaser;
  modo "Jugador 2" en el selector.
- **Terminado cuando:** dos jugadores pelean un combate completo; prueba con entradas simuladas.
- **Hecho:** modo `versus` («Rival: Jugador 2» en la selección: CPU → Práctica → Jugador 2).
  J1: WASD + J K U I L O P (las flechas solo cuando juega solo). J2: flechas + Insert/Inicio/
  Supr/Fin/RePág/AvPág o teclado numérico. Mandos con el plugin de Phaser (mando 1 → J1,
  mando 2 → J2; Start pausa). HUD, carteles, pie de controles y lista de movimientos muestran
  ambos jugadores. `input/Bindings.ts` concentra las teclas por jugador. Pruebas en
  `tests/versus.spec.ts` (teclado real y mandos simulados).

### [x] FUN-03 · Reasignar teclas en Configuración
- **Hacer:** fila "Controles" en `SettingsScene`; guardar en `localStorage`; botón restaurar.
- **Terminado cuando:** una tecla cambiada funciona en combate y persiste al recargar.
- **Hecho:** fila «Teclas de J1 y J2» en Configuración → `ControlsScene` (pestañas J1/J2, Enter
  y pulsar la tecla nueva). Rechaza teclas reservadas y repetidas en cualquiera de los dos
  jugadores; guarda en `localStorage` (`fighter-keys`); «Restaurar valores» vuelve a las de
  fábrica. Pruebas en `tests/controls.spec.ts`.

### [x] FUN-04 · Modo arcade
- **Hacer:** escalera contra cada rival del plantel con dificultad creciente y pantalla final
  por luchador.
- **Terminado cuando:** se puede completar la escalera y ver el final.
- **Hecho:** opción «Modo arcade» en el menú; `config/arcade.ts` arma la escalera (cada rival,
  espejo y jefe final; Fácil → Normal → Difícil; escenarios en orden); `ArcadeScene` (elegir,
  escalera, continuar, final por luchador) y `CreditsScene` con la procedencia de `art/` y
  `scripts/`. Continuaciones ilimitadas y contadas. Pruebas en `tests/arcade.spec.ts`.

### [x] FUN-05 · Modo entrenamiento mejorado
- **Hacer:** visor de entradas, datos de frames del último golpe y vida que se recupera.
- **Terminado cuando:** las tres opciones se activan desde la pausa del modo práctica.
- **Hecho:** tres filas nuevas en la pausa, solo en modo práctica: visor de entradas (últimas 12,
  con su duración en frames), datos de frames del último golpe (inicio, activo, recuperación y
  ventaja al golpear y al bloquear) y vida que se recupera 1 s después de terminar el combo.
  Se conservan al reiniciar. `ui/TrainingOverlay.ts`, `GAME_CONFIG.TRAINING`. Pruebas en
  `tests/training.spec.ts`.

### [~] FUN-06 · Publicación web
- **Hacer:** script de despliegue de `dist/` a itch.io o GitHub Pages (ruta base de Vite).
- **Terminado cuando:** el juego abre desde un link público.
- **En curso:** build preparado (`BASE_PATH` en Vite y `loader.baseURL` en Phaser, probado servido
  bajo `/Mugen-Family/` sin errores 404) y flujo manual `.github/workflows/pages.yml`. Falta que
  Jorell active Pages y lo ejecute; no se publicó nada.

## Calidad y proceso

### [~] CAL-04 · Limpiar versiones viejas de sprites
- **Hoy:** en `public/assets/characters` conviven `tilin`, `tilin-v2`, `tilin-v3`, `cesar` y
  `cesar-v2`.
- **Hacer:** verificar qué carga cada `manifest.json` y mover lo no usado fuera de `public/`.
- **Terminado cuando:** el build pesa menos y todas las pruebas pasan.
- **En curso:** inventario hecho (64 archivos, 28,5 MB que el juego no carga; detalle en
  `docs/DECISIONES.md`). Falta que Jorell decida si se mueven fuera de `public/`; no se movió nada.


### [x] CAL-01 · Linter y formato
- Agregar ESLint (typescript-eslint) y un script `npm run lint`; corregir lo que marque.
- **Terminado cuando:** `npm run lint` pasa sin errores.
- **Hecho:** `eslint.config.js` (flat config, reglas recomendadas de ESLint y typescript-eslint;
  `any` permitido solo en pruebas). Se corrigieron 8 importaciones y parámetros sin uso.

### [x] CAL-02 · Revisión de balance Tilin vs César
- Tabla con daño por golpe × `damage`, frames × `attackSpeed`, vida y alcance de cada uno;
  calcular cuántos golpes de cada tipo necesita cada luchador para ganar.
- **Terminado cuando:** la tabla está en `docs/BALANCE.md` y los ajustes acordados están en
  `roster.ts` / `AttackDefinition.ts`.
- **Hecho:** `docs/BALANCE.md` (atributos, frames, ventajas, golpes y combos para ganar) y
  `scripts/simulate-balance.mjs` (CPU contra CPU con semillas). César ganaba el 59 %; su daño
  bajó de 1.3 a 1.2 y queda 47 % – 53 %. Motivo en `docs/DECISIONES.md`.

### [x] CAL-03 · Registro de decisiones
- Crear `docs/DECISIONES.md` con las decisiones ya tomadas (Phaser 3, sprites con chroma key,
  plantel por manifiesto, audio sintetizado).
- **Hecho:** `docs/DECISIONES.md` con las decisiones previas y las de esta etapa; README al día;
  `CHANGELOG.md`; versión 0.2.0.

## Trabajo futuro (no MVP)

- Controles táctiles.
- Más luchadores (la escalera arcade y el balance se adaptan solos).
- Segundo especial por luchador con comandos de movimiento.
- Combos aéreos y juggles.
- Multijugador en línea (requiere servidor).
