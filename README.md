# Fighter Family

Juego de pelea 2D para navegador con Phaser 3, TypeScript y Vite. Incluye sprites nuevos de Tilin, canto sónico, música original y un menú con vista del escenario. Los recursos originales se conservan como respaldo.

## Ejecutar

Requiere Node.js 22 o posterior y npm.

```sh
npm ci
npm run dev
```

Abrir http://localhost:3000. El juego está pensado para teclado. El lienzo se adapta al tamaño de la ventana; no se han incorporado controles táctiles ni multijugador.

## Modos y escenarios

**Elegir luchadores** abre el selector arcade. El plantel tiene dos luchadores, cada uno con cuatro colores (Original, Amatista, Menta y Coral):

- **Tilin:** ágil, con canto sónico.
- **César:** grande y pesado. Tiene 125 de vida y pega un 30 % más fuerte, pero camina, salta y ataca más lento, y casi no retrocede al recibir golpes. Su poder es el *Pisotón sísmico*, una onda que recorre el suelo y se esquiva saltando. Su súper es *Terremoto del Morro*. Sus 23 animaciones usan ahora 276 cuadros redibujados, con apoyos y articulaciones naturales; dirección visual, prompts y procedencia en `art/cesar-v2/`. La versión anterior se conserva en `art/cesar/`.

Q / E cambia de luchador en el lado activo. Los colores no cambian las estadísticas. Para sumar un luchador: crea su carpeta en `public/assets/characters/<id>/` con `manifest.json` y agrega una entrada en `src/config/roster.ts`, con su ilustración de portada (`menuArtPath`, PNG transparente 2:3) y su lema (`motto`).

1. Elige luchador con Q / E o con el ratón, y el color con ← / → (A / D). Tab o ↑ / ↓ cambia entre jugador y rival. El botón central alterna CPU y práctica.
2. Confirma con Enter o **Elegir escenario**. Hay seis arenas en dos filas: las miniaturas y ← / → cambian de escenario; ↑ / ↓ o W / S cambian de fila.
3. Pulsa **¡A pelear!** o Enter: se muestra el versus y comienza el combate. Esc permite volver atrás, incluso durante el versus.

Las elecciones se conservan al volver al menú y reiniciar. **Cambiar selección**, en el menú de pausa, permite modificar el enfrentamiento. El menú principal tiene tres opciones: **Elegir luchadores**, **Galería de movimientos** y **Configuración**. El escenario y el rival (CPU o práctica) se eligen en el selector.

**Configuración** permite activar la pantalla completa, encender o apagar la música y ajustar el volumen de la música y el volumen general (música y efectos). Se navega con ↑ / ↓, se ajusta con ← / → y se cambia con Enter. Los ajustes se guardan en el navegador. En pantalla completa el juego ocupa toda la pantalla y mantiene la proporción 16:9.

- **CPU:** rival que se acerca, alterna ataques y bloquea con intervalos de reacción.
- **Muñeco de práctica:** rival pasivo para practicar movimiento, alcance y ataques.
- **Galería de movimientos:** previsualización de las animaciones; no es el modo de combate.
- **Escenarios de Arica:** Costanera del Morro al atardecer, Playa Chinchorro y Catedral San Marcos en Plaza Colón al anochecer.
- **Escenarios originales:** Arena Urbana Nocturna, Templo Antiguo y Azotea de Rascacielos.

La portada es una escena animada con efecto 3D sobre la costa de Arica. Al abrirse reproduce una entrada cinemática de 1,6 s: la cámara retrocede, las dos líneas del título caen desde la pantalla con sacudida, el luchador gira en perspectiva hasta su guardia y las opciones se despliegan como cartas. Después quedan vivos los rayos del sol, chispas en perspectiva real (las cercanas se mueven más con el puntero), ondas en el suelo y un título extruido cuyo relieve cambia con el punto de vista. El luchador gira hacia el puntero; la opción elegida se adelanta con un barrido de luz, y al confirmar la cámara se zambulle en la pantalla. Las opciones nunca se desplazan de lado. La preferencia del navegador **Reducir movimiento** muestra el menú terminado al instante y desactiva la entrada, la transición, los efectos ambientales y la respuesta al puntero, incluso si cambia con el menú abierto.

La portada presenta a los luchadores del plantel en orden aleatorio y los rota cada 6,5 s: el actual gira de canto, y el siguiente entra girando con su nombre, lema y poder. La ilustración de César (`public/assets/menu/cesar-3d.png`) se obtuvo recortando el fondo verde de `assets/Characters/Cesar/WATON MAIN.jpg`.

El selector comparte el lenguaje visual. Detrás hay un suelo de rejilla en perspectiva que avanza hacia el jugador, con horizonte luminoso y chispas. En **luchadores**, las tarjetas entran desde los lados, cada personaje está sobre un pedestal con anillos y foco, el VS en relieve cae con sacudida, y el personaje salta al cambiar de luchador o color. En **escenarios**, las miniaturas se levantan una tras otra, la vista grande se abre como una puerta y recorre la arena lentamente sin deformarla. En **combate listo**, los dos luchadores entran corriendo, un VS grande golpea la pantalla y la cruza una hoja de luz. Cada cambio reconstruye la pantalla en su posición final y anima encima, así que ninguna animación bloquea teclas ni clics. Con **Reducir movimiento** todo aparece quieto y completo.

Decisión técnica: el efecto usa solo Phaser (plano con perspectiva `Plane`, filtros `postFX` y proyección propia de partículas), sin añadir un motor 3D ni recursos nuevos. Con el renderizador Canvas la luchadora se dibuja plana y los brillos se omiten. Los efectos viven en `src/ui/menu/MenuEffects.ts` y `src/ui/selection/SelectionBackdrop.ts`, separados de la lógica de `MenuScene` y `SelectionScene`; `tests/menu-3d.spec.ts` y `tests/selection-3d.spec.ts` los verifican.

Las cinco imágenes originales de esta ampliación se generaron con ImageGen integrado y están en `public/assets/menu/` y `public/assets/stages/arica/`. Prompts, procedencia y referencias de los lugares: `art/arica/`. Los escenarios son interpretaciones artísticas adaptadas al combate; la portada combina ilustraciones en capas, sin introducir un motor de geometría 3D.

Las partidas duran 99 segundos y terminan por K.O. o tiempo. Un empate no asigna un ganador. La pausa detiene también las animaciones y los temporizadores; perder el foco de la ventana pausa automáticamente. Reiniciar conserva el rival y el escenario elegidos.

El HUD de combate está animado. Las barras de vida se llenan al abrir la ronda, bajan al instante con cada golpe y dejan una estela clara que las alcanza después, con destello y chispas en el borde; bajo el 25 % laten en rojo. Muestran la vida en número y tienen muescas cada 10 %. La barra de energía brilla y su etiqueta salta cuando el súper queda listo. El contador es un anillo que se vacía con el tiempo, late cada segundo y se pone rojo en los últimos diez. Los anuncios (ROUND, ¡PELEA!, K.O., TIEMPO, ¡VICTORIA!, DERROTA, EMPATE) son letras 3D que caen sobre una franja con sacudida y golpe sonoro: la victoria suma rayos dorados y lluvia de chispas; la derrota, un velo rojo y brasas que caen. `src/ui/EpicBanner.ts` concentra los anuncios y sus estilos; `tests/hud.spec.ts` los verifica. La duración de la entrada de ronda y del cierre no cambió.

## Controles

| Acción | Teclas |
| --- | --- |
| Moverse | A / D o flechas izquierda / derecha |
| Saltar / doble salto | W o flecha arriba; volver a pulsar en el aire |
| Agacharse | S o flecha abajo |
| Puño suave / fuerte | J / K |
| Patada suave / fuerte | U / I |
| Bloquear de frente | L |
| Canto sónico | O |
| Activar / silenciar música | M o botón de música |
| Volumen de música | , / . o botones − / + |
| Provocar | P |
| Pausa | Esc o botón de pantalla |
| Ver colisiones (depuración) | F1 en combate |
| Cambiar escenario | F2 |
| Pantalla completa | F11 o Configuración |

En el menú: flechas o W/S para elegir, Enter para confirmar. En el selector: A/D o ←/→ para cambiar color o escenario, Tab para cambiar de lado, Enter para avanzar y Esc para retroceder. En la galería: flechas para recorrer animaciones, 1–0 para selección directa, A para girar, F2 para cambiar fondo y Esc para volver.

El segundo salto permite superar la altura del rival y cambiar de lado manteniendo A/D o las flechas. Hay un máximo de dos saltos por vuelo; se recuperan al aterrizar. Mantener la tecla pulsada no activa saltos adicionales. La CPU también puede usar el doble salto; el muñeco de práctica sigue siendo pasivo.

Los impactos tienen cuatro sonidos originales: suave, fuerte, especial y bloqueo. Solo se reproducen al conectar, una vez por golpe; los ataques que fallan o alcanzan a un personaje invulnerable no suenan. El navegador habilita el audio al interactuar con el juego. Los WAV están en `public/assets/audio/` y se pueden regenerar con `node scripts/generate-sounds.mjs`.

La interfaz tiene tres sonidos propios, generados con `node scripts/generate-menu-sounds.mjs`: `menu-impact` (golpe grave al caer el título y el VS), `menu-whoosh` (barrido de aire en transiciones y cambios de luchador) y `menu-move` (tic al mover el cursor). Los navegadores bloquean el audio hasta el primer clic o tecla, así que la primera entrada de la portada es muda; después suenan siempre.

## Canto y música

**O** activa el súper de Tilin únicamente con **100 % de energía** y estando en el suelo. La barra empieza vacía: un golpe normal acertado aporta el doble de su daño más 6 puntos; recibirlo aporta su daño más 2. Un contacto bloqueado aporta 4 al atacante y 8 al defensor. Fallar o esperar no carga energía. La barra se limita a 100 y cada intento consume toda la carga, aunque falle o se bloquee. La CPU sigue las mismas reglas.

Tras 0,35 segundos de anticipación, Tilin libera el **golpe sónico inicial**. Un bloqueo frontal con **L**, un doble salto bien sincronizado o salir del alcance evitan que se confirme el súper. Bloquear esta onda no quita vida. Un golpe recibido durante la preparación o antes de que conecte la onda la cancela. El daño masivo nunca se aplica al fallar.

Si el primer golpe conecta sin bloqueo, comienza **Canto resonante**: retrato de Tilin cantando, ondas musicales, cinco pulsos y remate, durante 3 segundos. Sus siete impactos suman **60 de daño** y dejan al rival aturdido durante 0,9 segundos. Durante la secuencia se detienen el reloj y los movimientos; su daño no recarga energía. El K.O. se resuelve al finalizar la secuencia. **Esc** pausa también la animación y su sonido; reiniciar o salir limpia el efecto. El movimiento reducido del navegador elimina las sacudidas y el desplazamiento de las ondas.

El retrato original está en `public/assets/effects/tilin-super-canto.png`, generado con ImageGen integrado. El prompt y la dirección visual están en `art/super-canto/`. `node scripts/generate-super-sound.mjs` regenera el crescendo vocal y sus impactos originales; `node scripts/inspect-super.mjs` guarda capturas y verifica el daño de la secuencia completa.

La música original tiene dos arreglos en bucle: menú a 96 BPM y combate a 128 BPM. La pausa detiene la música del combate; al cambiar de escena no se superponen pistas. **M** silencia solo la música, manteniendo audibles los golpes y el canto. El volumen y la preferencia se guardan localmente. `node scripts/generate-music.mjs` regenera las dos pistas y el efecto vocal sintetizado, sin grabaciones externas.

## Verificar

```sh
npx playwright install chromium
npm test
npm run check
npm run build
npm audit
```

Las pruebas ejecutan el juego real en Chromium: controles al cambiar de lado, interrupción de ataques, tiempos de recuperación, caídas sin animación GET_UP, colisiones, bloqueo frontal, daño único por golpe, CPU, práctica, empate, pausa, reinicio, retorno al menú, reapertura de galería, carga fallida y adaptación de pantalla. La instrumentación queda en las pruebas, fuera de la aplicación.

`npm test` inicia Vite automáticamente si no hay servidor en el puerto 3000. `npm run test:ui` abre el explorador de pruebas.

Para una comprobación visual adicional, con el servidor activo:

```sh
node scripts/inspect.mjs
node scripts/inspect-sprites.mjs
node scripts/inspect-sonic.mjs
node scripts/inspect-arica.mjs
```

Las capturas se guardan en `artifacts/` y el script falla ante errores de ejecución o de recursos. Puede apuntarse a otro servidor con la variable `GAME_URL`.

## Compilar y servir

```sh
npm run build
npm run preview
```

Servir `dist/` mediante HTTP desde la raíz del sitio. No abrir `index.html` como archivo local. Phaser aporta la mayor parte del bundle; Vite puede mostrar un aviso de tamaño, sin impedir la compilación.

## Recursos y animaciones

César usa las 23 hojas transparentes nuevas de `public/assets/characters/cesar-v2/`, enlazadas desde su manifiesto estable en `public/assets/characters/cesar/manifest.json`. El levantamiento toma como referencia la pose final de pie; los puños, patadas y pisotón muestran su contacto durante la ventana activa del ataque. `node scripts/inspect-cesar.mjs` genera las hojas de contacto y una galería animada con pausa en `artifacts/cesar-v2/preview.html`, además de revisar los 276 cuadros cargados por el juego.

El manifiesto activo contiene **23 animaciones de 12 cuadros: 276 cuadros**. A las hojas de `public/assets/characters/tilin-v2/` se suman seis hojas en `public/assets/characters/tilin-v3/`: canto (sustituye el antiguo especial), aturdimiento, puño aéreo, patada aérea, segundo salto y aterrizaje. Las animaciones aéreas se activan con los mismos botones de ataque mientras se salta; aterrizar reproduce una recuperación breve que se puede cancelar moviéndose o saltando.

Las hojas se generaron mediante ImageGen integrado usando a Tilin como referencia. Los prompts completos, la procedencia y la dirección visual están en `art/tilin-v2/` y `art/tilin-v3/`. La nueva tanda contiene 72 cuadros, de los cuales 60 amplían la biblioteca y 12 sustituyen el especial anterior.

El manifiesto activo sigue en `public/assets/characters/tilin/manifest.json`. Declara la cuadrícula 4×3, velocidades y cuadros de impacto. El cargador conserva la transparencia original, busca los espacios transparentes entre cuadros, normaliza la escala y alinea el suelo. Ambos luchadores comparten las texturas procesadas. Los ataques sincronizan sus poses de anticipación, impacto y recuperación con los tiempos de combate.

Los JPG originales permanecen intactos. El manifiesto anterior está respaldado en `art/tilin-v2/original-manifest.json`; el cargador mantiene compatibilidad con sus hojas de tres cuadros y fondo verde. Si falta `GET_UP`, la recuperación conserva su alternativa segura. Si falla la descarga de recursos, se muestra una opción para reintentar.

`inspect-sprites.mjs` necesita el servidor de desarrollo en el puerto 3000. Guarda capturas, hojas de contacto y mediciones de los 276 cuadros en `artifacts/tilin-v2/`, y falla si encuentra cuadros vacíos, transparencia ausente, recortes en los bordes o errores de ejecución. `inspect-sonic.mjs` ejecuta la inspección actual del súper y guarda la barra cargada, la onda, el retrato, los impactos y la recuperación en `artifacts/super-canto/`.
