# Registro de decisiones — Fighter Family

Formato: fecha · contexto · decisión · motivo. Las más recientes van al final.

## Decisiones previas (antes de 2026-11-10)

### Motor: Phaser 3 con TypeScript y Vite
- **Decisión:** Phaser 3.87, sin motor 3D; el efecto 3D del menú usa planos con perspectiva y
  `postFX` de Phaser.
- **Motivo:** juego 2D por sprites, sin instalación, en cualquier navegador. Phaser 4 elimina
  pipelines, `preFX/postFX`, `setTintFill` y `Geom.Point`, que el código usa: no se actualiza sin
  una decisión nueva.

### Sprites en hojas 4×3 con transparencia (y chroma key de respaldo)
- **Decisión:** cada animación es una hoja de 12 cuadros; `SpriteSheetLoader` detecta los huecos
  transparentes, normaliza la escala y alinea el suelo. Las hojas antiguas de fondo verde siguen
  cargándose con chroma key (`CHROMA_COLOR`, `CHROMA_TOLERANCE`).
- **Motivo:** las hojas generadas mantienen proporciones entre animaciones y las viejas no se rompen.

### Plantel por manifiesto
- **Decisión:** un luchador = una entrada en `src/config/roster.ts` (nombre, poder, `FighterStats`,
  final del arcade) + `public/assets/characters/<id>/manifest.json`. Las estadísticas escalan los
  golpes comunes (`Fighter.scaleAttack`).
- **Motivo:** sumar luchadores sin tocar la lógica de combate.

### Audio sintetizado por código
- **Decisión:** música, golpes, voces y efectos se generan con `scripts/generate-*.mjs`.
- **Motivo:** sin licencias de terceros ni grabaciones externas; se regeneran en cualquier momento.

### Arte generado con procedencia
- **Decisión:** cada imagen generada guarda su prompt, herramienta y origen en `art/<tema>/`; en
  `public/` solo va lo que el juego carga.
- **Motivo:** trazabilidad y créditos correctos (la pantalla de créditos del arcade la resume).

## 2026-11-10 · Aturdimiento de guardia sin escalar por velocidad de ataque
- **Contexto:** `FighterStats.attackSpeed` divide los frames de cada ataque (César es más lento).
- **Decisión:** `blockstun` y `blockPushback` no se escalan con el atacante; el empuje se divide
  por el `weight` del defensor, igual que el retroceso al recibir golpes.
- **Motivo:** el aturdimiento es del defensor. Así los golpes lentos de César quedan más en
  desventaja al ser bloqueados, coherente con un luchador pesado. Es la opción más conservadora:
  no cambia ningún valor existente.

## 2026-11-10 · El reloj del round sigue corriendo durante el hitstop
- **Contexto:** el hitstop congela a los luchadores 50–120 ms por golpe.
- **Decisión:** el reloj del round no se detiene; solo se congelan luchadores, sus temporizadores
  de estado y sus animaciones. El súper anula cualquier hitstop pendiente al empezar.
- **Motivo:** el reloj marca tiempo real de partida, como en los arcades del género; además, así
  el hitstop no cambia la duración de los rounds ni las pruebas de tiempo existentes.

## 2026-11-10 · Dificultad de la CPU por datos y con semilla
- **Contexto:** la CPU rotaba 4 golpes en orden fijo y bloqueaba 1 de cada 3 ataques.
- **Decisión:** tres perfiles en `GAME_CONFIG.CPU_DIFFICULTY`; *Normal* conserva aproximadamente el
  ritmo anterior. Cada ataque entrante se evalúa una sola vez (por `Fighter.attackSerial`), así
  pensar más rápido no regala bloqueos extra. El azar sale de `makeRandom(seed)`: sin semilla en
  el juego, con semilla fija en las pruebas. La dificultad se elige en la selección (X) y viaja
  con los datos de la partida; no se guarda en el navegador.
- **Motivo:** balance editable sin tocar lógica y pruebas deterministas.

## 2026-11-10 · Las 4 pruebas que fallaban
- **Contexto:** se reportaron fallos en `cesar.spec.ts` («César can be picked with E…»),
  `menu-3d.spec.ts` («the title screen starts on a roster fighter…») y las dos «real keyboard
  double jump…» de `super.spec.ts`.
- **Hallazgo:** con el súper de César ya integrado (85f31bf) las cuatro pasan: 20/20 al repetirlas
  5 veces y también en las tandas completas. Ninguna regla del código fallaba; dependen de tiempo
  real. La causa concreta encontrada está en la prueba de César: un `waitForTimeout(200)` entre
  los dos Enter de la selección podía perder el segundo bajo carga.
- **Decisión:** reemplazar esas esperas fijas por esperas al estado de la escena. Las demás no se
  tocan porque ya esperan condiciones del juego, no tiempos fijos.
- **Motivo:** cambio mínimo y solo en pruebas; no se desactiva ni se salta ninguna.

## 2026-11-10 · Escalera del modo arcade
- **Contexto:** el plantel tiene 2 luchadores; una escalera de un solo rival sería muy corta.
- **Decisión:** cada rival del plantel, luego el combate espejo, y como jefe final una revancha
  contra el primer rival en Difícil (mínimo 3 combates, `GAME_CONFIG.ARCADE.MIN_FIGHTS`). La
  dificultad sube de forma pareja de Fácil a Difícil. Los rivales nunca usan el color del jugador.
  Las continuaciones son ilimitadas pero se cuentan y se muestran en el final.
- **Motivo:** escala sola al sumar luchadores en `roster.ts`, sin tocar la lógica.
- **Menú:** «Modo arcade» es la segunda opción; se actualizaron las 4 pruebas que navegaban el menú
  por posición.

## 2026-11-10 · Teclas y mandos para dos jugadores
- **Contexto:** J1 usaba WASD y las flechas a la vez; las teclas `,` `.` y `M` controlan la música.
- **Decisión:** J2 usa las flechas y el bloque Insert/Inicio/RePág/Supr/Fin/AvPág (en portátiles sin
  teclado numérico) o el teclado numérico. En un combate de dos jugadores, J1 pierde cualquier
  tecla que sea de J2; jugando solo, J1 conserva las flechas. Mandos con distribución estándar:
  X/Y puños, A/B patadas, RB o LT bloqueo, RT súper, LB provocar, Start pausa.
- **Motivo:** ninguna tecla hace dos cosas en el mismo combate y el modo de un jugador no cambia.
- **Nota:** una tecla pulsada y soltada dentro del mismo cuadro se pierde (Phaser borra JustDown al
  soltar); las pruebas mantienen cada pulsación 60 ms, igual que las existentes.

## 2026-11-10 · Balance: daño de César de 1.3 a 1.2
- **Contexto:** la tabla de `docs/BALANCE.md` mostraba a César muy adelante en la carrera de daño
  (necesita 100 ÷ 1.3 ≈ 77 «unidades» de daño para ganar; Tilin, 125), algo que su 25 % de
  lentitud no compensa. En 120 rounds CPU contra CPU (`scripts/simulate-balance.mjs`) César ganó el
  59 % (57 % en Normal y 62 % en Difícil).
- **Decisión:** `damage` de César pasa de 1.3 a 1.2 (golpes 6/14/7/18 en vez de 7/16/8/20). Con el
  ajuste, en 240 rounds Tilin gana el 53 % y César el 47 %.
- **Descartado:** bajar su vida a 115 (cambia la identidad de «tanque»), acelerar sus golpes
  (cambia las animaciones sincronizadas) o tocar los súpers (60 de daño fijos para ambos).
- **Motivo:** es el cambio más pequeño que corrige un desequilibrio claro, y la CPU no aprovecha la
  velocidad de Tilin, así que el ajuste no debe ir más allá. Revisar con partidas de dos jugadores.

## 2026-11-10 · Sprites que el juego no carga (pendiente de decisión de Jorell)
- **Cómo se midió:** se registraron en el navegador todas las peticiones a `/assets/characters/`
  al cargar el juego, pelear Tilin vs César en ambos lados y abrir la galería de movimientos
  (48 archivos pedidos), y se compararon con los 112 archivos de esa carpeta.
- **Lo que sí se carga:** `tilin/manifest.json` y `cesar/manifest.json` (los manifiestos estables),
  17 hojas de `tilin-v2/<ANIM>/<ANIM>.png`, las 6 de `tilin-v3/` y las 23 de `cesar-v2/`.
- **Lo que no se carga (64 archivos, 28,5 MB):**

  | Carpeta | Archivos | Peso | Qué es |
  | --- | ---: | ---: | --- |
  | `tilin/` (todo menos `manifest.json`) | 39 | 21,1 MB | JPG originales de Tilin; el README dice que se conservan como respaldo |
  | `cesar/` (todo menos `manifest.json`) | 23 | 4,8 MB | Primera versión de las hojas de César, reemplazada por `cesar-v2/` |
  | `tilin-v2/IDLE.png` | 1 | — | Copia suelta de la hoja de reposo; el juego usa `tilin-v2/IDLE/IDLE.png` |
  | `tilin-v2/SPECIAL_ATTACK/SPECIAL_ATTACK.png` | 1 | — | Especial anterior; el canto de `tilin-v3/` lo sustituyó |
  | (los dos de `tilin-v2/` juntos) | 2 | 2,6 MB | |

- **Por qué importa:** Vite copia todo `public/` a `dist/`, así que estos 28,5 MB viajan en cada
  publicación (`dist/assets/characters` pesa 85 MB) sin que el juego los use.
- **No se movió ni borró nada.** Opciones para Jorell: (a) moverlos a una carpeta fuera de `public/`
  (por ejemplo `art/originals/`), que es lo que pide `CLAUDE.md` para los originales; (b) dejarlos;
  (c) borrarlos si ya hay copia en otro lado. Solo `tests/game.spec.ts` toca `tilin/manifest.json`, que
  se queda donde está en cualquier caso.
