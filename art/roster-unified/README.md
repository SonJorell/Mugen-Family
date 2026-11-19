# Plantel unificado — noviembre de 2026

Arte de combate 2D pintado, contornos y sombreado comunes. Se conservan las identidades, prendas y movimientos; César es el más corpulento, Jorell tiene un torso más ancho que Joako, brazos y piernas más delgados y abdomen moderado, visible bajo la polera. Estaturas: Tata 165 cm, Tilin 167 cm, Joako 181 cm, Jorell 182 cm, César 183 cm.

Jorell lleva lentes rectangulares negros de cristal claro, también transformado. Los dos dragones aportados por el usuario están en el brazo del reloj negro: diseño amplio en hombro/brazo superior y dragón alargado en antebrazo. La pulsera roja corresponde al brazo sin tatuajes.

## Fuentes y producción

Todas las hojas nuevas y las revisiones se generaron con **ImageGen integrado**, sin CLI. `jobs.json` contiene los prompts de Tilin/César; `sources.json` sus archivos de origen. Joako tiene `joako/prompts.json` y `joako/sources.json`. Jorell conserva `jorell/tattoo-prompts.json` y un registro `*-source.json` por hoja; las correcciones finales y transparencias tienen registros propios con prompt y origen. La revisión de proporciones de Jorell está en `jorell/proportion-prompts.json` y los registros `*-proportion-source.json`. Tilin conserva la corrección del jean del segundo fotograma de WALK_FORWARD en `tilin/jeans-fix.json`: ambas piernas quedan cubiertas hasta el tobillo. Los originales generados se conservaron. Los PNG `*-before-*` son revisiones anteriores, no activos del juego.

- Tilin: 23 animaciones / 276 poses.
- César: 23 animaciones / 276 poses.
- Joako: 25 animaciones / 174 poses; SCAR integrada en las manos.
- Jorell: 28 animaciones / 186 poses; ciclo de reposo de 12 cuadros, portada y retrato del súper actualizados. El reposo registrado y sus prompts están documentados en `../super-unified/README.md`.
- Tata: 27 animaciones / 168 poses; retrato 3D para el selector y retrato del súper. Escala de 165 cm. Suéter verde tejido, jeans completos y zapatillas oscuras, según la referencia del usuario.

`node scripts/pack-roster.mjs --audit` inspecciona transparencia y poses. `node scripts/pack-roster.mjs` recorta y codifica las hojas en WebP, preservando el alfa, y actualiza los manifiestos de `public/assets/characters/<id>/manifest.json`. Los archivos activos nuevos están en `public/assets/characters/<id>-unified/`. No se altera el alfa por código: los fallos de fondo se corrigieron con ImageGen. Las esquinas nominales que atraviesa una mano o pie se distinguen de un fondo opaco; el cargador busca canales transparentes entre figuras.

La altura visual de guardia se calibra a partir de su silueta. Se mantiene escala uniforme, un punto horizontal de referencia y el apoyo de los movimientos terrestres; los movimientos aéreos conservan su desplazamiento dentro del cuadro. Las manos del Kamehameha y el cañón de la SCAR usan la misma normalización que sus sprites.

## Verificación

`node scripts/inspect-roster.mjs` produce comparación de estaturas, selector, galerías y auditoría de las 1080 poses del juego en `artifacts/roster-unified/visual`. Requiere Vite en 3018. Las pruebas de estaturas, selección y combate están en `tests/roster-height.spec.ts`, `tests/jorell.spec.ts`, `tests/joako.spec.ts` y las pruebas de animación de César/Tilin. La revisión visual del súper de Jorell usa `scripts/inspect-jorell.mjs`.

Revisión del 18 de noviembre: se corrigió el jean de WALK_FORWARD_1 de Tilin y se revisaron las 180 poses y los dos retratos de Jorell. `tests/sprite-isolation.spec.ts` comprueba que el doble salto no contiene partes del fotograma vecino. El cargador amplía la búsqueda del canal transparente al 40 % de la celda, sin superponer búsquedas contiguas ni alterar píxeles. `tests/jorell.spec.ts` verifica que el Kamehameha nace junto a las manos visibles en ambas orientaciones; sus puntos se midieron de nuevo sobre las hojas de carga y lanzamiento.

Los resultados de transparencia/recortes están en `artifacts/roster-unified/visual/runtime-audit.json`; la comparación corporal y el pantalón corregido están junto a ese archivo. Los recorridos visuales completos de los súper se guardan en `artifacts/roster-unified/jorell-production/` y `artifacts/roster-unified/joako-production/`. La compilación final está en `dist/`.

## Tata · Brindis a pedales

Los PNG fuente están en `tata/`, generados con **ImageGen integrado**, sin CLI. `tata/prompts-initial.json` y `tata/prompts-animations.json` contienen los prompts; cada hoja tiene su registro `*-source.json`. `tata/attacks-alpha-source.json` registra la limpieza del fondo semitransparente; `attacks-before-alpha.png` conserva la versión anterior. El empaquetado conserva el alfa generado.

Las animaciones incluyen combate, salto, doble salto, caída y recuperación, brindis, montaje y ciclo completo de pedaleo. Bicicleta, manos y pies están dibujados juntos para mantener sus puntos de contacto. El súper se sincroniza con el reloj pausado de combate: empujón (6 de daño), choque (42) y caída (12); al cancelar no quedan capas, sonidos ni daño pendiente. `scripts/generate-bike-sound.mjs` crea el audio original de 6 segundos.

`tests/tata.spec.ts` cubre el selector, energía, bloqueo, evasión, interrupción, ambas orientaciones, pausa, KO, cancelación, colores y CPU/arcade. `scripts/inspect-tata.mjs` captura cada fase en ambas direcciones; acepta `GAME_URL`, `OUTPUT_DIR` y `REDUCED_MOTION`. Resultados en `artifacts/tata/visual/` y `artifacts/tata/production/`.
