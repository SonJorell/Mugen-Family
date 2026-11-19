# Jorell

Esta carpeta conserva la primera versión y el retrato de portada. La revisión vigente de proporciones, sprites y súper se documenta en [../jorell-v2/README.md](../jorell-v2/README.md).

Personaje basado en `JORELL MAIN.jpg`, aportado por el usuario. La versión final respeta la corrección posterior: complexión delgada y natural, hombros estrechos, brazos y piernas finos; la transformación conserva el mismo cuerpo.

Los siete atlas y el retrato se generan con ImageGen integrado. Los prompts completos están en [prompts.md](prompts.md). Cada atlas mide 1536 × 1024 y contiene cuatro animaciones de seis poses; 28 animaciones y 168 poses en total. El retrato del menú es una ilustración 3D sin píxeles.

Procedencia de los archivos finales (copiados desde la carpeta `generated_images` de Codex):

| Archivo | Generación |
| --- | --- |
| movement.png | exec-c1da18bb-4f6d-4816-bcf8-64e6daee49d3.png |
| air.png | exec-c259fd05-9e65-43b7-a63b-94915f604893.png |
| attacks.png | exec-e99accde-0e3d-4daf-8033-52c8d1e87c5d.png |
| defense.png | exec-f6c88a6b-f984-41f9-b1e7-4e7c6b985558.png (extracción de fondo) |
| recovery.png | exec-fd7cae6c-71ac-4c0a-b291-0ad79738c665.png |
| super.png | exec-92df062e-0601-4f86-b261-051b1e3f8ab8.png (corrección del golpe bajo) |
| finish.png | exec-533352a3-44ef-46a0-8e6e-a235915519be.png |
| portrait.png | exec-dd5af3b2-2efb-4029-b1d8-646c02635c7e.png |

| Atlas | Animaciones |
| --- | --- |
| movement.png | Guardia, caminar adelante, caminar atrás, desplazamiento rápido |
| air.png | Agacharse, salto, puñetazo aéreo, patada aérea |
| attacks.png | Puños y patadas suaves/fuertes |
| defense.png | Bloqueo, recibir golpe, aturdimiento, levantarse |
| recovery.png | Caída, derrota, victoria, provocación |
| super.png | Golpe al estómago, teletransporte, transformación, carga |
| finish.png | Kamehameha, volver a forma normal, doble salto, aterrizaje |

`node scripts/pack-jorell.mjs` valida la transparencia de las esquinas de las 168 celdas y empaqueta las filas a WebP sin modificar el alfa. Produce `public/assets/characters/jorell/manifest.json` y sus archivos. Altura base de referencia: 238 px; suelo: y248 dentro de cada celda.

Movimientos equilibrados: 100 de vida, velocidad/salto/fuerza/peso base. Súper con O y energía al 100 %: golpe cercano al estómago (bloqueable, evitable con distancia, salto o invulnerabilidad; preparación interrumpible), teletransporte lejos, cabello dorado, carga entre las manos y Kamehameha. Daño total: 60. Solo un golpe confirmado inicia la secuencia. El consumo de energía ocurre al intentarlo.

La secuencia dura 5,4 s, conserva el reloj del combate y respeta pausa, movimiento reducido, cancelación y reinicio. La posición del teletransporte se confirma al finalizar; cancelar conserva las posiciones originales. El pelo vuelve a negro al terminar. El sonido es síntesis original reproducible con `node scripts/generate-kame-sound.mjs`.

Verificación: `tests/jorell.spec.ts`, `scripts/inspect-jorell.mjs` (capturas de ambas direcciones; `RECORD=1` también prueba entradas reales y graba vídeo). Informes locales en `artifacts/jorell`.
