# César — Furia del i30

Secuencia solicitada: agarre, lanzamiento hasta el otro extremo del escenario, entrada en el i30 plateado de referencia, atropello arcade sin sangre y regreso a la posición inicial con una Monster negra y verde.

## Recursos

Cinco recortes transparentes generados con ImageGen integrado conservan el acabado 3D de la portada de César: agarre, lanzamiento, entrada al auto, auto con conductor y celebración. `prompts.json` guarda las instrucciones completas; `assets.json` registra cada original y su copia en el proyecto, incluida la corrección de la puerta metálica. `reference-i30.png` conserva la referencia aportada por el usuario. Se preserva el alfa original de los PNG.

## Secuencia y reglas

| Tiempo | Acción | Daño |
|---|---|---:|
| 0 ms | Agarre confirmado | 4 |
| 550–1450 ms | Lanzamiento y caída al otro extremo | 12 al caer |
| 1450–2450 ms | Entrada al auto y cierre de puerta | 0 |
| 2450–3300 ms | Motor y aceleración | 0 |
| 3300 ms | Contacto del auto e impacto | 44 |
| 4050–5800 ms | Regreso con la Monster | 0 |

El agarre requiere energía completa, rival cercano y en el suelo. Se bloquea de frente o se evita saltando/alejándose; recibir un golpe interrumpe la preparación. Fallar consume la energía y deja recuperación. La CPU usa el mismo ataque.

`SuperMove` conserva la autoridad del reloj, el daño, la pausa, el cierre de ronda y la limpieza. `CesarDriveSequence` solo presenta la secuencia con imágenes y efectos calculados desde ese reloj. No usa callbacks de daño retrasado ni temporizadores independientes. Al completar se aplican las posiciones finales y se encuadra a los luchadores; cancelar antes conserva sus posiciones de combate.

El audio procedural original se genera con `scripts/generate-drive-sound.mjs`. La pista única sigue las mismas reglas de pausa y volumen que los otros efectos. El escenario se consulta al confirmar el agarre, incluso si se cambió con F2.

## Revisión

`tests/cesar-drive.spec.ts` prueba energía, alcance, defensa, salto, interrupción, secuencia en ambas direcciones, daño, posición final, encuadre, cancelación, pausa/reinicio, K.O. y movimiento reducido. `scripts/inspect-drive.mjs` guarda capturas de cada fase usando el cargador y renderizador reales. El resto de pruebas conserva la cobertura del canto de Tilin.
