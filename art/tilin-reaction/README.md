# Reacciones de Tilin durante Furia del i30

36 dibujos originales generados con ImageGen integrado, conservando la identidad de `public/assets/menu/tilin-3d.png`.

| Lámina final | Poses | Uso |
| --- | --- | --- |
| `public/assets/effects/tilin-reaction/caught-flight.png` | 12 | Agarre, elevación, lanzamiento y preparación de la caída |
| `public/assets/effects/tilin-reaction/ground-recovery.png` | 12 | Amortiguación, apoyo lateral, rodillas, incorporación y guardia |
| `public/assets/effects/tilin-reaction/impact-tumble.png` | 12 | Reacción al auto, vuelo, rodamiento y reposo |

Los prompts y las rutas de los originales están en `prompts.json`. Se conservan los PNG y su transparencia originales. Las divisiones no son regulares: `DriveSpriteAtlas.ts` registra las filas y columnas según los espacios entre siluetas, recorta los márgenes al cargar y mantiene una escala constante por lámina. Las referencias de altura son la pose 0 de vuelo e impacto y la pose 11 de recuperación.

`TilinDriveReaction.ts` sigue el reloj de la cinemática para soportar pausa, saltos temporales, orientación invertida y movimiento reducido. La animación termina de pie si Tilin sobrevive o tendida si queda en K.O.; no modifica los tiempos de daño ni el coste de energía del súper.

## Segunda pasada: vuelo, caída y orientación

Se añadieron otros 32 dibujos con ImageGen integrado:

| Lámina final | Poses | Uso |
| --- | --- | --- |
| `public/assets/effects/tilin-reaction/flight-v2.png` | 16 | Intermedios entre la liberación del agarre y el contacto con el suelo |
| `public/assets/effects/tilin-reaction/landing-v2.png` | 16 | Amortiguación, movimiento de piernas y apoyo antes de incorporarse |

`prompts-v2.json` contiene los prompts de generación; `flight-v2-repack.json` registra la corrección de márgenes de la lámina de vuelo. Los dibujos originales permanecen disponibles.

Durante el vuelo, el registro usa el centro de la silueta para que recoger las piernas no desplace todo el cuerpo de golpe. Al apoyar en el suelo se vuelve al contacto inferior. Las poses intermedias avanzan a ritmo constante, y Tilin mira al rival durante la secuencia y al volver al combate, incluso si estaba orientada al lado contrario antes del agarre.
