# César · sprites v2

Las 23 animaciones se han redibujado con ImageGen integrado usando `assets/Characters/Cesar/WATON MAIN.jpg` como referencia de identidad. Cada hoja contiene 12 cuadros consecutivos en una cuadrícula 4×3: 276 dibujos. Los PNG conservan su canal alfa original.

## Dirección de movimiento

César conserva su cuerpo robusto, pelo oscuro con flequillo rubio, camiseta gris, tatuajes, pantalón corto negro y zapatillas celestes. Las poses flexionan codos, rodillas y tobillos; el torso acompaña el cambio de peso. La versión anterior basada en recortes queda conservada en `public/assets/characters/cesar/`.

- Guardia: respiración y flexión leve, pies apoyados.
- Marcha: apoyos alternados y transferencia del peso, con manos en guardia.
- Puños: preparación de cadera y hombro, extensión y retorno.
- Patadas: rodilla recogida, extensión y retirada de la pierna antes de apoyar.
- Saltos y aterrizaje: compresión por las articulaciones y recuperación gradual del equilibrio.
- Caída y levantarse: apoyo de manos, rodilla bajo las caderas y ascenso por una sentadilla.
- Pisotón: elevación de rodilla, apoyo fuerte y rebote del torso.

## Integración

El manifiesto estable `public/assets/characters/cesar/manifest.json` apunta a las hojas versionadas de `public/assets/characters/cesar-v2/`. Se retira la escala fija del antiguo rig. La pose de pie del cuadro 12 de GET_UP define su escala; los saltos conservan la altura relativa de los pies para mantener la recogida de rodillas.

Cuadros de contacto, con índices desde cero y final exclusivo:

| Movimiento | Inicio | Fin |
|---|---:|---:|
| Puño suave | 4 | 6 |
| Puño fuerte | 6 | 8 |
| Patada suave | 5 | 7 |
| Patada fuerte | 6 | 8 |
| Puño / patada aérea | 5 | 8 |
| Pisotón | 7 | 9 |

El cambio visual conserva las estadísticas, velocidades de ataque, daño, energía y reglas de combate existentes.

## Procedencia y revisión

`prompts.json` contiene el prompt final por animación. `assets.json` registra las rutas originales de ImageGen, sus destinos y la edición de transparencia de GET_UP. `original-manifest.json` conserva la configuración anterior.

Con Vite ejecutándose, `node scripts/inspect-cesar.mjs` mide transparencia, cuadros vacíos y recortes de los 276 cuadros procesados por el cargador real. Guarda hojas de contacto, capturas de combate, `validation.json` y una galería animada con pausa en `artifacts/cesar-v2/`. También admite `GAME_URL` para inspeccionar la compilación de producción.

`tests/cesar-animation.spec.ts` comprueba que los ataques fuertes muestran su extensión al comenzar a causar daño y que levantarse conserva la escala, el suelo y la silueta completa.
