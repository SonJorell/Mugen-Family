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

### [ ] PEL-02 · Búfer de entradas
- **Hoy:** `InputManager` usa `JustDown`; un golpe pulsado mientras termina el anterior se
  pierde.
- **Hacer:** guardar la última pulsación de ataque durante `INPUT_BUFFER_MS` (≈100 ms, en
  `gameConfig.ts`) y ejecutarla en cuanto el luchador pueda actuar.
- **Terminado cuando:** una prueba pulsa J durante la recuperación de K y el puño suave sale
  al terminar, una sola vez.

### [ ] PEL-03 · Bloqueo con consecuencia (blockstun y empuje)
- **Hoy:** `Fighter.receiveHit` al bloquear solo resta 10 % de daño; no hay empuje ni
  aturdimiento de guardia, y un golpe fuerte bloqueado no deja al atacante expuesto.
- **Hacer:** agregar `blockstun` y `blockPushback` a `AttackDefinition`; el que bloquea retrocede
  y queda unos frames en guardia; los golpes fuertes quedan en desventaja al ser bloqueados.
- **Terminado cuando:** pruebas verifican el empuje y que tras bloquear un HEAVY_KICK el
  defensor puede golpear antes de que el atacante se recupere.

### [ ] PEL-04 · Lista de movimientos en la pausa
- **Hoy:** `PauseScene` no muestra controles.
- **Hacer:** opción "Movimientos" que lista teclas por luchador (leídas de `InputMapping.ts` y
  `roster.ts`, no escritas a mano).
- **Terminado cuando:** se abre desde la pausa con teclado, muestra el poder correcto de Tilin
  y de César y vuelve con Esc.

## Calidad y proceso

### [ ] CAL-01 · Linter y formato
- Agregar ESLint (typescript-eslint) y un script `npm run lint`; corregir lo que marque.
- **Terminado cuando:** `npm run lint` pasa sin errores.

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
