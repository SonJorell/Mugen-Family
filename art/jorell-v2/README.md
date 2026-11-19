# Jorell · revisión de proporciones y súper

Corrección solicitada: cabeza proporcionada, cuerpo ligeramente mayor que Joako y menor que César, sin musculatura exagerada. Se regeneraron las siete hojas de combate usando el retrato adulto aprobado como referencia. La escala uniforme de combate y del selector es 1,08, frente a 0,96 de Joako y 1,14 de César. El tamaño del cuerpo, las colisiones y el alcance mantienen la misma relación; la velocidad, el salto y los 100 puntos de vida siguen siendo normales.

28 animaciones y 180 poses utilizadas: 26 secuencias de seis fotogramas y dos secuencias nuevas de doce para transformación y lanzamiento. Las hojas normales son 1536 × 1024, de seis columnas por cuatro filas, cuerpo base 238 px y suelo y248. Las nuevas hojas son de cuatro columnas por tres filas, cuerpo base 306 px y suelo y331. El empaquetador sustituye TRANSFORM y BEAM por estas secuencias de doce fotogramas.

`node scripts/pack-jorell.mjs` conserva el alfa y valida las esquinas de todas las celdas. No pinta ni elimina fondos. Las correcciones de transparencia de `air.png` y `release.png` se hicieron con ImageGen. El retrato de portada sigue en `../jorell/portrait.png`; `cutin.png` es la nueva ilustración del súper, exportada como `super-cutin.webp`.

La cinemática dura 6,8 s: golpe al estómago en primer plano, teletransporte, retrato de presentación, transformación de doce poses, carga, lanzamiento de doce poses, rayo e impacto final, regreso a la forma normal. Un contenedor de mundo independiente mueve el encuadre sin cambiar la cámara jugable ni el HUD. La esfera y el rayo siguen las manos de cada pose. Aura dorada, luz difusa, partículas, ondas y reacción del rival se calculan con el reloj del combate, sin temporizadores pendientes.

Se mantienen energía completa, apertura bloqueable/esquivable/interrumpible, 60 puntos de daño total, pausa de imagen y sonido, cancelación, espejo, CPU y KO. Movimiento reducido elimina barridos de cámara y sacudidas. La posición final solo se confirma si termina el súper. `node scripts/generate-kame-sound.mjs` reproduce la banda sonora sintetizada y sincronizada de 6,8 s.

Prompts completos en [prompts.md](prompts.md). Procedencia ImageGen:

| Archivo | Imagen generada |
| --- | --- |
| movement.png | exec-40d298cf-6d1b-4d3b-9cbb-82b768af4904.png |
| air.png | exec-a3035c75-922d-4fcd-9633-4204f0535d54.png, alfa corregido |
| attacks.png | exec-c04051d3-2209-4a29-ad03-d4b5f27f6d4c.png |
| defense.png | exec-c8324648-f21e-486a-ae64-87cf7df813a0.png |
| recovery.png | exec-8defa213-0dde-4d58-85ad-e9e4a707a3c9.png |
| super.png | exec-c4f97584-a3cd-473f-9a01-d10c1d5ec737.png |
| finish.png | exec-eb27fa93-efd0-44a0-a2bc-467d1351177d.png |
| transformation.png | exec-17c5901f-a3e6-414f-ad45-cbc7a8b13919.png |
| release.png | exec-8f08c054-88fe-46e6-9eff-6790efea373d.png, alfa corregido |
| cutin.png | exec-de6b95d1-2318-4794-a03f-828b3b25e30a.png |

Verificación: `tests/jorell.spec.ts` y `scripts/inspect-jorell.mjs`, con capturas de todas las fases en ambos sentidos; `RECORD=1` prueba las teclas reales y graba vídeo. `REDUCED_MOTION=1` comprueba la presentación sin barridos. Informes, auditoría alfa y comparación de cuerpos en `artifacts/jorell-v2`.
