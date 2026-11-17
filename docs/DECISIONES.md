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

## 2026-11-13 · Imágenes en WebP con alfa sin pérdida (CAL-05)
- **Medición inicial** (`scripts/measure-load.mjs`, caché vacía): el juego descargaba 95,4 MB al
  arrancar (90 MB de PNG/JPG, 3 MB de audio); con 20 Mbit/s simulados tardaba 45,5 s en mostrar el
  menú. Todo se carga en `PreloadScene`; las hojas de luchadores sumaban 57 MB.
- **Decisión:** `scripts/convert-webp.py` (Pillow) escribe un `.webp` junto a cada imagen que el
  juego carga y solo cambian las referencias (manifiestos, `roster.ts`, `GAME_CONFIG.STAGES` y la
  costa del menú). Color con pérdida (calidad 90) y **alfa sin pérdida** (`alpha_quality=100`).
  Los originales se quedan donde están.
- **Verificación del recorte:** se compararon los 552 cuadros procesados por `SpriteSheetLoader`
  antes y después: mismo tamaño y misma máscara alfa en los 552, mismos píxeles visibles; el color
  medio cambia 4,7/255 de mediana (máx. 8,9). Comparando archivo contra archivo, el color visible
  difiere 2–3/255. Las capturas de combate lado a lado no muestran diferencias a simple vista.
- **Resultado:** 57 imágenes pasan de 80 MB a 18,9 MB. Descarga total 95,4 → 37,1 MB; menú a
  20 Mbit/s 45,5 → 21,0 s. En local, sin red, los tiempos no cambian de forma apreciable.
- **Fuera de alcance:** los recursos del súper de César (`driveAssets.ts`) y los nuevos de
  `cesar-drive-fluid/` y `tilin-reaction/` (16,2 MB de PNG) los está editando otra sesión; quedan
  para cuando ese trabajo tenga commit (basta con añadirlos a la lista del script).
- **Nota:** `dist/` no adelgaza mientras los originales sigan en `public/`, pero el navegador ya no
  los pide. Moverlos fuera de `public/` es la misma decisión pendiente de CAL-04.

## 2026-11-13 · Locutor con un sintetizador de formantes propio (PEL-07)
- **Contexto:** todo el audio del juego se genera por código; no hay grabaciones ni licencias.
- **Decisión:** `scripts/generate-announcer.mjs` es un sintetizador de formantes mínimo (pulso glotal,
  tres resonadores por fonema, ruido para fricativas y explosivas, tono grave con acento en la
  sílaba tónica, saturación y eco de estadio). Las frases se escriben como fonemas del español.
  Se descartaron el TTS del sistema operativo (licencia de redistribución dudosa y distinto en cada
  equipo), la Web Speech API (depende del navegador y no siempre tiene voz en español) y descargar
  un motor externo.
- **Consecuencia:** es una voz robótica estilizada, de arcade; los carteles siguen mostrando el
  texto, así que nada depende de entenderla. Se puede reemplazar regenerando los WAV con el mismo
  nombre. El nivel de fricativas se ajusta con `HISS`.
- **Volumen por categoría:** `GameAudio` envuelve una sola vez `play` y `add` del gestor de sonido
  global y aplica el volumen según la clave (`announcer-*`, efectos), sin tocar cada llamada.

## 2026-11-17 · Locutor con la voz «koku» de Voicebox
- **Contexto:** Jorell pidió que el locutor use su voz clonada «koku» con el efecto «Deep Voice»
  de Voicebox, que corre en su PC, en lugar de la voz de formantes.
- **Decisión:** `scripts/generate-announcer-koku.py` llama a la API local de Voicebox
  (127.0.0.1:17493): por línea genera hasta cuatro tomas en seco, las transcribe con el Whisper de
  Voicebox, se queda con la que mejor coincide (la más corta si empatan), le aplica la cadena
  Deep Voice (tono −3 semitonos, paso bajo 6 kHz, compresor), recorta silencios y normaliza a
  −1 dBFS. Los nombres de archivo no cambian, así que el código del juego no se toca.
- **Consecuencia:** «K.O.» se dice «¡Nocaut!» porque el modelo nunca pronunció bien las letras.
  Regenerar requiere Voicebox abierto con el perfil «koku»; cada corrida da tomas distintas.
  `generate-announcer.mjs` queda como respaldo sin dependencias.

## 2026-11-13 · Controles táctiles por posición de los dedos (FUN-07)
- **Decisión:** en vez de eventos por botón, cada cuadro se mira dónde está cada dedo
  (`input.manager.pointers`) y qué botón tiene debajo, con un 25 % de margen. Los golpes, el salto
  y el súper se disparan una vez por toque; moverse, agacharse y bloquear actúan mientras se tocan.
- **Motivo:** permite deslizar el pulgar de ◀ a ▶ sin levantarlo y combinar dirección y golpe con
  dos dedos, que es como se juega en pantallas táctiles.
- **Alcance:** solo el jugador 1 (dos jugadores en una misma pantalla táctil no caben con este
  tamaño de botones). Se muestran si el dispositivo es táctil, se ocultan con una tecla y vuelven
  con el siguiente toque, así un portátil con pantalla táctil no queda tapado.

## 2026-11-13 · Especiales de comando con animaciones existentes (PEL-08)
- **Decisión:** un especial por luchador, sin energía, con el comando ↓ ↘ → + puño (la diagonal es
  opcional; ↓ primero, → antes de 450 ms y el puño antes de 260 ms, en `GAME_CONFIG.COMMAND`).
  Tilin: «Paso veloz», un avance con golpe sobre la animación DASH, ágil y castigable. César:
  «Pisotón sísmico», bajo y lento, que derriba, sobre HEAVY_KICK. Ambos son datos en
  `COMMAND_MOVES` y se cancelan desde los golpes suaves.
- **Motivo:** dan a cada luchador una herramienta propia sin arte nuevo, y siguen su estilo: Tilin
  entra rápido desde lejos y César castiga de cerca a costa de quedar muy expuesto.
- **Tiempo:** la detección usa un reloj sumado con `delta`, no la hora del sistema ni los cuadros.

## 2026-11-15 · Música del menú aportada por Jorell (AUD-01)
- **Contexto:** Jorell aportó «Cinturão de Elite» (MP3, 2:56, 192 kb/s, estéreo) y pidió usarla como
  música del menú.
- **Decisión:** se copia como `public/assets/audio/cinturao-de-elite.mp3` (su archivo original queda
  sin tocar) y suena en el menú principal y las pantallas que comparten su música; el combate
  conserva su pista sintetizada y la pista original del menú queda como alternativa en
  Configuración. Se carga en segundo plano al abrir el menú (no alarga la pantalla de carga) y
  hasta que llega el menú queda en silencio; si la descarga falla, suena la pista original. El
  bucle usa un marcador de 0,09 s a 174,9 s para saltar el silencio inicial y el de después del
  desvanecimiento final.
- **Licencia:** la canción no es un recurso generado por el proyecto. **Hay que confirmar su
  licencia antes de publicar el juego**; los créditos lo indican.

## 2026-11-15 · Dash, dash atrás y lo que quedó fuera (PEL-09)
- **Decisión:** el dash es un estado (`DASHING`), no un ataque, así no se confunde con el «Paso
  veloz» de Tilin (un ataque que solo reutiliza la animación DASH). Doble toque en 220 ms o tecla
  de dash con dirección. Los toques hechos con ↓ pulsado no cuentan, así ↓ ↘ → + puño sigue siendo
  el comando, y mantener una dirección para caminar es un solo toque. El dash adelante usa la
  animación DASH; el dash atrás, WALK_BACKWARD (no hay animación propia y no se genera arte nuevo).
  Bloquear tiene prioridad sobre el dash.
- **Valores:** adelante 640 px/s durante 190 ms y 90 ms de recuperación; atrás 560 px/s durante
  210 ms, invulnerable los primeros 110 ms y 170 ms de recuperación castigable.
- **Mando:** LB pasa a ser dash y provocar pasa a Back, porque provocar no tiene uso en combate.
- **Fuera de alcance:** dash aéreo, porque el doble salto ya da la movilidad aérea y un tercer
  impulso en el aire rompería la lectura de los saltos; y carrera al mantener adelante tras el dash,
  porque cerraba la distancia demasiado rápido para el espaciado actual (los dos luchadores quedan
  a 90 px como mínimo y César camina un 28 % más lento). Se pueden retomar como tickets propios.

## 2026-11-16 · Combos: rutas, juggle, escalado y tope (PEL-10)
- **Rutas como datos:** cada ataque lista en `cancelsInto` a qué puede cancelarse, y solo cuando ya
  tocó al rival (golpe o bloqueo). La cadena de golpes suaves es de un paso (puño → patada, nunca al
  revés), así no hay bucles de golpes suaves.
- **Ataques nuevos sin arte nuevo:** agachado + suave = «Patada baja» (animación LIGHT_KICK con caja
  baja), agachado + puño fuerte = «Lanzador» (HEAVY_PUNCH), agachado + patada fuerte = «Barrido»
  (HEAVY_KICK, derriba). Los ataques en el aire usan datos propios (`AIR_PUNCH`, `AIR_KICK`) con más
  aturdimiento, para enlazar al aterrizar. Visualmente reutilizan poses de pie: es la limitación de
  no generar arte.
- **Juggle acotado:** tras el lanzador el rival queda en `JUGGLED`; caben 3 golpes en el aire, cada
  uno lo eleva menos y aumenta la gravedad un 35 %; al tocar el suelo queda derribado.
- **Sin infinitos:** los dos primeros golpes de un combo hacen daño entero; desde el tercero, −15 %
  por golpe hasta un mínimo del 30 %. Al octavo golpe el combo termina con un derribo, y el daño
  acumulado nunca supera el 45 % de la vida máxima del rival (el súper queda fuera, porque tiene su
  propio daño fijo). Una prueba intenta un bucle con dash cancels durante 10 s y lo comprueba.
- **Dash cancel:** el puño fuerte que conecta se cancela en dash adelante, y del dash adelante se
  puede atacar tras 100 ms, para seguir el combo dentro del aturdimiento.

## 2026-11-16 · Agarre (PEL-11)
- **Decisión:** J + U de cerca (reasignables como puño y patada suaves). Los dos botones pueden
  llegar con hasta 60 ms de diferencia: un golpe suave que todavía está arrancando y no ha tocado se
  convierte en agarre; si ya conectó, sigue siendo la cadena del combo (J → U). El agarre ignora la
  guardia y, si no se escapa en 250 ms, hace 13 de daño y derriba.
- **Sin bucles imbloqueables:** no se puede agarrar a un rival en el aire, aturdido, en guardia tras
  un golpe, en un juggle ni en el suelo, y escapar empuja a ambos.
- **Animaciones:** quien agarra usa HEAVY_PUNCH y quien es agarrado HIT_REACTION; no hay animación
  de lanzamiento propia (no se genera arte nuevo).

## 2026-11-16 · Tipografías
- **Decisión:** Rajdhani para interfaz y menús, Teko para los nombres sobre las barras de vida, Anton
  para reloj, salud y combos, y Edo SZ para los anuncios (ROUND, ¡PELEA!, K.O.) y títulos. Viven en
  `public/assets/fonts` y se usan solo a través de las constantes de `src/ui/fonts.ts`.
- **Pendiente antes de publicar:** Edo SZ (Vic Fieger) es freeware sin términos escritos de
  redistribución. Hay que confirmar su licencia antes de subir el juego a un sitio público; mientras
  tanto Black Ops One (OFL) queda en la carpeta como reemplazo abierto.
- **Selección sin colores:** la pantalla de selección ya no ofrece paletas porque vendrán skins por
  personaje; en un combate espejo el rival se tiñe solo para distinguirlo.
