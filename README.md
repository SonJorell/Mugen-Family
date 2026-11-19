# Fighter Family

Juego de pelea 2D para navegador con Phaser 3, TypeScript y Vite. Cinco luchadores de Arica (Tilin, César, Joako, Jorell y Tata), modo arcade con escalera de rivales, combates contra la CPU en tres dificultades, dos jugadores en el mismo teclado o con mandos, modo práctica con herramientas de entrenamiento, combos, súpers cinemáticos y música original. Los recursos originales se conservan como respaldo.

## Ejecutar

Requiere Node.js 22 o posterior y npm.

```sh
npm ci
npm run dev
```

Abrir http://localhost:3000. Se juega con teclado, mando (hasta dos) o controles táctiles en pantalla (J1). El lienzo se adapta al tamaño de la ventana manteniendo 16:9; no hay juego en línea.

## Modos y escenarios

**Elegir luchadores** abre el selector arcade con los cinco luchadores del plantel (en combates espejo, el rival toma automáticamente un tono alternativo; en **Modo arcade** también puedes elegir entre cuatro colores: Original, Amatista, Menta y Coral):

- **Tilin:** ágil, con canto sónico.
- **César:** grande y pesado. Tiene 125 de vida y pega un 20 % más fuerte, pero camina, salta y ataca más lento, y casi no retrocede al recibir golpes. Su súper, *Furia del i30*, comienza con un agarre cercano: lanza al rival al extremo opuesto, sube a su Hyundai i30, lo atropella en una secuencia arcade y vuelve a su posición con una Monster. Sus 23 animaciones usan 276 cuadros redibujados; dirección visual, prompts y procedencia en `art/cesar-v2/`. Los recursos de la cinemática están documentados en `art/cesar-drive/`.

- **Joako:** rápido y ágil. Su súper conecta un pelotazo, construye pared y escalera y dispara desde la estructura.
- **Jorell:** movimientos equilibrados; golpe al estómago, teletransporte, transformación dorada y Kamehameha.
- **Tata:** 165 cm, 110 de vida y movimiento tranquilo. Su súper, *Brindis a pedales*, requiere energía completa y un empujón inicial que puede bloquearse o esquivarse: bebe cerveza, monta su bicicleta, arrolla al rival y vuelve para brindar. Son 60 de daño en una secuencia de 6 segundos con sonidos originales de botella, campanilla, pedales e impacto.

Q / E cambia de luchador en el lado activo. Los colores no cambian las estadísticas. Para sumar un luchador: crea su carpeta en `public/assets/characters/<id>/` con `manifest.json` y agrega una entrada en `src/config/roster.ts`, con su ilustración de portada (`menuArtPath`, PNG transparente 2:3) y su lema (`motto`).

1. Elige luchador con ← / → (o Q / E) o haciendo clic en los retratos centrales. Tab o ↑ / ↓ cambia entre jugador y rival. El botón central alterna el rival: **CPU**, **Práctica** o **Jugador 2**. Contra la CPU, **X** o el botón inferior cambian la dificultad: **Fácil**, **Normal** o **Difícil**.
2. Confirma con Enter o **Continuar**. Hay seis arenas en dos filas: las miniaturas y ← / → cambian de escenario; ↑ / ↓ o W / S cambian de fila.
3. Pulsa **¡A pelear!** o Enter: se muestra el versus y comienza el combate. Esc permite volver atrás, incluso durante el versus.

Las elecciones se conservan al volver al menú y reiniciar. **Cambiar selección**, en el menú de pausa, permite modificar el enfrentamiento. El menú principal tiene cinco opciones: **Elegir luchadores**, **Modo arcade**, **Galería de movimientos**, **Configuración** y **Estadísticas**. El escenario, el rival y la dificultad se eligen en el selector.

**Configuración** permite activar la pantalla completa, encender o apagar la música, ajustar volúmenes independientes (música, general, efectos y locutor) y elegir entre las pistas aportadas (*Cinturão de Elite* en el menú y *Hardline Beatdown* en combate) o las pistas originales sintetizadas. Se navega con ↑ / ↓, se ajusta con ← / → y se cambia con Enter. Los ajustes se guardan en el navegador. En pantalla completa el juego ocupa toda la pantalla y mantiene la proporción 16:9.

En **Configuración → Teclas de J1 y J2** se reasigna cada acción de cada jugador: se elige la acción, Enter y la tecla nueva. El juego rechaza teclas repetidas (de cualquiera de los dos jugadores) y las reservadas (Esc, F1, F2, F11, M, Enter, Tab, coma y punto). Los cambios se guardan en el navegador; **Restaurar valores** vuelve a las teclas de fábrica.

- **CPU:** rival con tres dificultades. Cambian el tiempo de reacción, la probabilidad de bloquear, el ritmo de ataque, los anti-aéreos, el castigo a golpes fallados y la frecuencia de combos. Los valores están en `GAME_CONFIG.CPU_DIFFICULTY`.
- **Modo arcade:** eliges luchador y color y subes una escalera: cada rival del plantel, el combate espejo y un jefe final, de Fácil a Difícil y en escenarios distintos. Al perder puedes continuar desde ese combate o volver al menú. Al ganar el último combate se muestran el final de tu luchador y los créditos.
- **Jugador 2:** dos personas en el mismo teclado, o con dos mandos. Los carteles anuncian «¡GANA J1!» o «¡GANA J2!».
- **Muñeco de práctica:** rival pasivo en sesión continua (al vaciar la vida se reinicia el asalto sin salir al menú) para practicar movimiento, alcance y combos. En la pausa del modo práctica se activan tres herramientas: **visor de entradas** (últimas 12 entradas con su duración en frames), **datos de frames** del último golpe (inicio, activo, recuperación y ventaja al golpear y al bloquear) y **vida que se recupera** un segundo después de terminar el combo.
- **Galería de movimientos:** previsualización de todas las animaciones de los cinco luchadores (Q / E o Tab para cambiar de luchador, 1–0 y ← / → para animaciones, F2 para cambiar escenario).
- **Escenarios de Arica:** Costanera del Morro al atardecer, Playa Chinchorro y Catedral San Marcos en Plaza Colón al anochecer.
- **Escenarios originales:** Arena Urbana Nocturna, Templo Antiguo y Azotea de Rascacielos.

La portada es una escena animada con efecto 3D sobre la costa de Arica. Al abrirse reproduce una entrada cinemática de 1,6 s: la cámara retrocede, las dos líneas del título caen desde la pantalla con sacudida, el luchador gira en perspectiva hasta su guardia y las opciones se despliegan como cartas. Después quedan vivos los rayos del sol, chispas en perspectiva real (las cercanas se mueven más con el puntero), ondas en el suelo y un título extruido cuyo relieve cambia con el punto de vista. El luchador gira hacia el puntero; la opción elegida se adelanta con un barrido de luz, y al confirmar la cámara se zambulle en la pantalla. Las opciones nunca se desplazan de lado. La preferencia del navegador **Reducir movimiento** muestra el menú terminado al instante y desactiva la entrada, la transición, los efectos ambientales y la respuesta al puntero, incluso si cambia con el menú abierto.

La portada presenta a los luchadores del plantel en orden aleatorio y los rota cada 6,5 s: el actual gira de canto, y el siguiente entra girando con su nombre, lema y poder. La ilustración de César (`public/assets/menu/cesar-3d-v2.png`) usa el mismo acabado 3D suave de Tilin; fue generada con ImageGen integrado y su procedencia está en `art/cesar-menu-3d/`.

El selector comparte el lenguaje visual. Detrás hay un suelo de rejilla en perspectiva que avanza hacia el jugador, con horizonte luminoso y chispas. En **luchadores**, el fondo es el video `public/assets/menu/fondo menu personajes.mp4` en bucle y sin sonido: cada luchador elegido aparece grande a su lado (1P a la izquierda, rival a la derecha), cortado por el borde inferior, con su nombre en letras de fuego en la esquina; los retratos del plantel van en una fila arriba al centro con las marcas 1P y CPU, un VS grande en relieve cae solo al centro, y abajo quedan **Rival** y, debajo, **Volver**, **CPU: dificultad** y **Continuar**. En **escenarios**, las miniaturas se levantan una tras otra, la vista grande se abre como una puerta y recorre la arena lentamente sin deformarla. En **combate listo**, los dos luchadores entran corriendo, un VS grande golpea la pantalla y la cruza una hoja de luz. Cada cambio reconstruye la pantalla en su posición final y anima encima, así que ninguna animación bloquea teclas ni clics. Con **Reducir movimiento** todo aparece quieto y completo.

Decisión técnica: el efecto usa solo Phaser (plano con perspectiva `Plane`, filtros `postFX` y proyección propia de partículas), sin añadir un motor 3D ni recursos nuevos. Con el renderizador Canvas la luchadora se dibuja plana y los brillos se omiten. Los efectos viven en `src/ui/menu/MenuEffects.ts` y `src/ui/selection/SelectionBackdrop.ts`, separados de la lógica de `MenuScene` y `SelectionScene`; `tests/menu-3d.spec.ts` y `tests/selection-3d.spec.ts` los verifican.

Las cinco imágenes originales de esta ampliación se generaron con ImageGen integrado y están en `public/assets/menu/` y `public/assets/stages/arica/`. Prompts, procedencia y referencias de los lugares: `art/arica/`. Los escenarios son interpretaciones artísticas adaptadas al combate; la portada combina ilustraciones en capas, sin introducir un motor de geometría 3D.

Los combates son al mejor de 3 rounds de 99 segundos; cada round termina por K.O. o tiempo y un empate no suma. La pausa detiene también las animaciones y los temporizadores; perder el foco de la ventana pausa automáticamente. Reiniciar conserva el rival, la dificultad y el escenario elegidos. **Movimientos**, en la pausa, muestra las teclas de cada jugador y el poder de cada luchador.

### Combate

- **Bloqueo alto/bajo:** L bloquea de frente golpes medios y aéreos estando de pie, y golpes bajos (`↓ + U` y barrido `↓ + I`) manteniendo `↓ + L`. Al bloquear, el defensor retrocede y queda unos frames en guardia; un golpe fuerte bloqueado deja al atacante expuesto a un contraataque.
- **Impacto:** cada golpe congela a ambos luchadores entre 55 y 120 ms según su fuerza (el reloj sigue corriendo), los golpes fuertes sacuden la cámara y saltan chispas en el punto de contacto: naranjas al golpear y un escudo azul al bloquear. Con *Reducir movimiento* no hay sacudidas y las chispas no se mueven.
- **Combos:** un golpe suave que toca al rival se puede cancelar en uno más fuerte: puño suave → patada suave, puño o patada fuertes; patada suave → fuertes. Por ejemplo, J y luego K, o J, U, I. Mientras el rival sigue aturdido aparece «N HITS» con el daño total.
- **Balance:** tabla de frames, ventajas y golpes para ganar en `docs/BALANCE.md`.

El HUD de combate está animado. Las barras de vida se llenan al abrir la ronda, bajan al instante con cada golpe y dejan una estela clara que las alcanza después, con destello y chispas en el borde; bajo el 25 % laten en rojo. Muestran la vida en número y tienen muescas cada 10 %. La barra de energía brilla y su etiqueta salta cuando el súper queda listo. El contador es un anillo que se vacía con el tiempo, late cada segundo y se pone rojo en los últimos diez. Los anuncios (ROUND, ¡PELEA!, K.O., TIEMPO, ¡VICTORIA!, DERROTA, EMPATE) son letras 3D que caen sobre una franja con sacudida y golpe sonoro: la victoria suma rayos dorados y lluvia de chispas; la derrota, un velo rojo y brasas que caen. `src/ui/EpicBanner.ts` concentra los anuncios y sus estilos; `tests/hud.spec.ts` los verifica. La duración de la entrada de ronda y del cierre no cambió.

## Controles

| Acción | Jugador 1 | Jugador 2 | Mando |
| --- | --- | --- | --- |
| Moverse | A / D (y ← / → jugando solo) | ← / → | Cruceta o stick |
| Saltar / doble salto | W (y ↑ jugando solo); otra vez en el aire | ↑ | Arriba |
| Agacharse | S (y ↓ jugando solo) | ↓ | Abajo |
| Puño suave / fuerte | J / K | Insert / Inicio, o Num 4 / Num 5 | X / Y |
| Patada suave / fuerte | U / I | Supr / Fin, o Num 1 / Num 2 | A / B |
| Bloquear de frente | L | AvPág o Num 3 | RB o LT |
| Súper del personaje (energía completa) | O | RePág o Num 6 | RT |
| Dash adelante / atrás | Espacio (+ A atrás), o doble toque D / A | Retroceso o Num + (+ ← atrás), o doble toque → / ← | LB (+ atrás) |
| Provocar | P | Num 0 | Back |
| Pausa | Esc o botón de pantalla | Esc | Start |

El mando 1 controla al jugador 1 y el mando 2 al jugador 2. Las teclas de J1 y J2 se cambian en **Configuración → Teclas de J1 y J2**.

| Acción general | Teclas |
| --- | --- |
| Activar / silenciar música | M o botón de música |
| Volumen de música | , / . o botones − / + |
| Ver colisiones (depuración) | F1 en combate |
| Cambiar escenario | F2 |
| Pantalla completa | F11 o Configuración |

En el menú: flechas o W/S para elegir, Enter para confirmar. En el selector: A/D o ←/→ para cambiar color o escenario, Tab para cambiar de lado, X para la dificultad de la CPU, Enter para avanzar y Esc para retroceder. En el arcade: ←/→ luchador, ↑/↓ color, Enter para pelear y Esc para volver. En la galería: flechas para recorrer animaciones, 1–0 para selección directa, A para girar, F2 para cambiar fondo y Esc para volver.

El segundo salto permite superar la altura del rival y cambiar de lado manteniendo A/D o las flechas. Hay un máximo de dos saltos por vuelo; se recuperan al aterrizar. Mantener la tecla pulsada no activa saltos adicionales. La CPU también puede usar el doble salto; el muñeco de práctica sigue siendo pasivo.

Los impactos tienen cuatro sonidos originales: suave, fuerte, especial y bloqueo. Solo se reproducen al conectar, una vez por golpe; los ataques que fallan o alcanzan a un personaje invulnerable no suenan. El navegador habilita el audio al interactuar con el juego. Los WAV están en `public/assets/audio/` y se pueden regenerar con `node scripts/generate-sounds.mjs`.

La interfaz tiene tres sonidos propios, generados con `node scripts/generate-menu-sounds.mjs`: `menu-impact` (golpe grave al caer el título y el VS), `menu-whoosh` (barrido de aire en transiciones y cambios de luchador) y `menu-move` (tic al mover el cursor). Los navegadores bloquean el audio hasta el primer clic o tecla, así que la primera entrada de la portada es muda; después suenan siempre.

## Súper y música

**O** activa el súper de Tilin únicamente con **100 % de energía** y estando en el suelo. La barra empieza vacía: un golpe normal acertado aporta el doble de su daño más 6 puntos; recibirlo aporta su daño más 2. Un contacto bloqueado aporta 4 al atacante y 8 al defensor. Fallar o esperar no carga energía. La barra se limita a 100 y cada intento consume toda la carga, aunque falle o se bloquee. La CPU sigue las mismas reglas.

Tras 0,35 segundos de anticipación, Tilin libera el **golpe sónico inicial**. Un bloqueo frontal con **L**, un doble salto bien sincronizado o salir del alcance evitan que se confirme el súper. Bloquear esta onda no quita vida. Un golpe recibido durante la preparación o antes de que conecte la onda la cancela. El daño masivo nunca se aplica al fallar.

Si el primer golpe conecta sin bloqueo, comienza **Canto resonante**: retrato de Tilin cantando, ondas musicales, cinco pulsos y remate, durante 3 segundos. Sus siete impactos suman **60 de daño** y dejan al rival aturdido durante 0,9 segundos. Durante la secuencia se detienen el reloj y los movimientos; su daño no recarga energía. El K.O. se resuelve al finalizar la secuencia. **Esc** pausa también la animación y su sonido; reiniciar o salir limpia el efecto. El movimiento reducido del navegador elimina las sacudidas y el desplazamiento de las ondas.

El retrato original está en `public/assets/effects/tilin-super-canto.png`, generado con ImageGen integrado. El prompt y la dirección visual están en `art/super-canto/`. `node scripts/generate-super-sound.mjs` regenera el crescendo vocal y sus impactos originales; `node scripts/inspect-super.mjs` guarda capturas y verifica el daño de la secuencia completa.

**César — Furia del i30:** con la barra al 100 %, **O** intenta un agarre de corta distancia. La preparación permite interrumpirlo con un golpe; bloquear de frente con **L**, saltar o alejarse evita la secuencia. Cada intento consume la barra. Al conectar, el agarre causa 4 de daño, el lanzamiento 12 y el atropello 44: **60 en total**. La secuencia dura 5,8 s, detiene el reloj y no recarga energía. César regresa al punto donde agarró; el rival queda aturdido en el extremo opuesto. Incluso un golpe fatal espera al regreso con la Monster antes de cerrar la ronda. Esc pausa también el motor; cancelar o reiniciar elimina el auto y todo daño pendiente. El movimiento reducido elimina las sacudidas y las estelas rápidas.

Los recursos de la secuencia están en `public/assets/effects/cesar-drive/`, `cesar-drive-fluid/` y `tilin-reaction/` (WebP transparentes). `node scripts/generate-drive-sound.mjs` regenera el audio original de agarre, lanzamiento, puerta, motor, atropello y lata. `node scripts/inspect-drive.mjs` revisa ambas direcciones y guarda las capturas y el informe en `artifacts/cesar-drive/`; acepta `GAME_URL` para revisar una compilación de producción.

La música de menú reproduce *Cinturão de Elite* y la de combate reproduce *Hardline Beatdown* (ambas configurables desde **Configuración** para volver a las pistas originales sintetizadas de 96 BPM y 128 BPM, que también sirven de respaldo automático). La pausa detiene la música del combate; al cambiar de escena no se superponen pistas. **M** silencia solo la música, manteniendo audibles los golpes, el locutor y los súpers. Las tipografías empaquetadas (Rajdhani, Teko, Anton y Black Ops One) usan licencia SIL OFL. `node scripts/generate-music.mjs` regenera las pistas sintetizadas originales sin grabaciones externas.

## Verificar

```sh
npx playwright install chromium
npm run lint
npm run check
npm test
npm run build
npm audit
```

`npm run lint` revisa el código con ESLint y typescript-eslint; `npm run check` revisa los tipos.

Las pruebas ejecutan el juego real en Chromium: controles al cambiar de lado, interrupción de ataques, tiempos de recuperación, caídas sin animación GET_UP, colisiones, bloqueo frontal, daño único por golpe, CPU, práctica, empate, pausa, reinicio, retorno al menú, reapertura de galería, carga fallida, adaptación de pantalla, bloqueo con aturdimiento y empuje, hitstop, combos, dificultad de la CPU, modo arcade, dos jugadores con teclado y mandos simulados, reasignación de teclas y herramientas de práctica. La instrumentación queda en las pruebas, fuera de la aplicación.

`npm test` inicia Vite automáticamente si no hay servidor en el puerto 3000. `npm run test:ui` abre el explorador de pruebas.

Para una comprobación visual adicional, con el servidor activo:

```sh
node scripts/inspect.mjs
node scripts/inspect-sprites.mjs
node scripts/inspect-sonic.mjs
node scripts/inspect-arica.mjs
node scripts/simulate-balance.mjs   # CPU contra CPU: Tilin vs César
```

Las capturas se guardan en `artifacts/` y el script falla ante errores de ejecución o de recursos. Puede apuntarse a otro servidor con la variable `GAME_URL`.

## Compilar y servir

```sh
npm run build
npm run preview
```

Servir `dist/` mediante HTTP. No abrir `index.html` como archivo local. Phaser aporta la mayor parte del bundle; Vite puede mostrar un aviso de tamaño, sin impedir la compilación.

Para servirlo desde una subcarpeta (por ejemplo `https://usuario.github.io/Mugen-Family/`), compilar con `BASE_PATH`: todas las rutas `/assets/...` se cargan bajo esa base (`src/config/assetBase.ts`).

```sh
BASE_PATH=/Mugen-Family/ npm run build
```

### Integración continua y GitHub Pages

- `.github/workflows/ci.yml` corre lint, tipos, build y las pruebas Playwright en cada push y pull request.
- `.github/workflows/pages.yml` publica en GitHub Pages **solo a mano**. Para usarlo: en el repositorio, **Settings → Pages → Source: GitHub Actions**, y luego **Actions → Publicar en GitHub Pages → Run workflow**. Compila con `BASE_PATH=/<nombre-del-repositorio>/`. Nada se publica solo.

## Recursos y animaciones

César usa las 23 hojas transparentes nuevas de `public/assets/characters/cesar-v2/`, enlazadas desde su manifiesto estable en `public/assets/characters/cesar/manifest.json`. El levantamiento toma como referencia la pose final de pie; los puños, patadas y pisotón muestran su contacto durante la ventana activa del ataque. `node scripts/inspect-cesar.mjs` genera las hojas de contacto y una galería animada con pausa en `artifacts/cesar-v2/preview.html`, además de revisar los 276 cuadros cargados por el juego.

El manifiesto activo contiene **23 animaciones de 12 cuadros: 276 cuadros**. A las hojas de `public/assets/characters/tilin-v2/` se suman seis hojas en `public/assets/characters/tilin-v3/`: canto (sustituye el antiguo especial), aturdimiento, puño aéreo, patada aérea, segundo salto y aterrizaje. Las animaciones aéreas se activan con los mismos botones de ataque mientras se salta; aterrizar reproduce una recuperación breve que se puede cancelar moviéndose o saltando.

Las hojas se generaron mediante ImageGen integrado usando a Tilin como referencia. Los prompts completos, la procedencia y la dirección visual están en `art/tilin-v2/` y `art/tilin-v3/`. La nueva tanda contiene 72 cuadros, de los cuales 60 amplían la biblioteca y 12 sustituyen el especial anterior.

El manifiesto activo sigue en `public/assets/characters/tilin/manifest.json`. Declara la cuadrícula 4×3, velocidades y cuadros de impacto. El cargador conserva la transparencia original, busca los espacios transparentes entre cuadros, normaliza la escala y alinea el suelo. Ambos luchadores comparten las texturas procesadas. Los ataques sincronizan sus poses de anticipación, impacto y recuperación con los tiempos de combate.

Los JPG originales permanecen intactos. El manifiesto anterior está respaldado en `art/tilin-v2/original-manifest.json`; el cargador mantiene compatibilidad con sus hojas de tres cuadros y fondo verde. Si falta `GET_UP`, la recuperación conserva su alternativa segura. Si falla la descarga de recursos, se muestra una opción para reintentar.

`inspect-sprites.mjs` necesita el servidor de desarrollo en el puerto 3000. Guarda capturas, hojas de contacto y mediciones de los 276 cuadros en `artifacts/tilin-v2/`, y falla si encuentra cuadros vacíos, transparencia ausente, recortes en los bordes o errores de ejecución. `inspect-sonic.mjs` ejecuta la inspección actual del súper y guarda la barra cargada, la onda, el retrato, los impactos y la recuperación en `artifacts/super-canto/`.

## Plantel unificado y estaturas

La revisión de noviembre de 2026 unifica el acabado pintado de los cinco luchadores con 1080 poses en 126 animaciones. Las escalas de combate y los retratos del selector usan las estaturas indicadas: Tata 165 cm, Tilin 167 cm, Joako 181 cm, Jorell 182 cm y César 183 cm. Jorell conserva lentes negros, un torso más ancho que Joako, brazos y piernas más delgados, una panza moderada y visible y ambos tatuajes de dragón en el brazo del reloj, incluyendo su transformación y retratos.

Los PNG, prompts y registros de ImageGen están en `art/roster-unified/`; los activos del juego en `public/assets/characters/*-unified/`. Para reconstruir esta revisión se usa `node scripts/pack-roster.mjs`. La auditoría y capturas del plantel se generan con `node scripts/inspect-roster.mjs` y Vite en el puerto 3018.

El reposo de Jorell usa 12 cuadros registrados para mantener los pies en su sitio. Las cinemáticas de César y Sofía/Tilin usan el mismo acabado pintado: entrada al i30, regreso con Monster, canto y reacciones. El canto conserva el escenario elegido. Fuentes y prompts: `art/super-unified/`; inspección de ambos sentidos y el reposo: `node scripts/inspect-super-style.mjs` (preview en 4173 o `GAME_URL`).
