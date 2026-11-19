# Ciclo de reposo y cinemáticas unificadas — noviembre 2026

Imágenes creadas/editadas con ImageGen integrado (sin CLI). Los prompts y referencias están en `prompts-initial.json`, `prompts-tilin.json` y los archivos `*-source.json`.

- Jorell: 12 poses de respiración con pies registrados. Reemplazan los 6 cuadros desalineados de IDLE; mantienen gafas, tatuajes, ropa y proporción corporal.
- César: 12 poses de agarre/lanzamiento, 8 de entrada al i30 y 12 de regreso con Monster. La versión final de entrada es `cesar-boarding-scaled.png`, con la proporción del conductor corregida. Las demás imágenes de entrada quedan como fuentes de la iteración.
- Sofía/Tilin: retrato de canto y 68 poses de reacción al súper del i30, redibujadas con el estilo pintado del plantel. Mantienen ambos pantalones, gafas, ropa y dirección de la cara.

El alpha original se conserva. `scripts/pack-super-art.mjs` codifica a WebP; no dibuja, elimina fondos ni modifica píxeles. `scripts/audit-super-art.mjs` mide transparencias, siluetas y separaciones entre cuadros. Los cortes de las hojas de reacción están registrados en `DriveSpriteAtlas.ts`.

El IDLE fuente también se guarda en `art/roster-unified/jorell/idle.png` para que `scripts/pack-roster.mjs --characters=jorell` reproduzca el resultado. Se conserva la calibración anterior del resto de animaciones.
