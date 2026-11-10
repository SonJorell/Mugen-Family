# César

Segundo luchador del plantel. Es grande y pesado, así que se juega distinto de Tilin.

## Estadísticas (src/config/roster.ts)

| Rasgo | César | Tilin |
| --- | --- | --- |
| Tamaño (sprite, hurtbox, alcance) | ×1,14 | ×1 |
| Vida | 125 | 100 |
| Velocidad al caminar | ×0,72 | ×1 |
| Salto | ×0,86 | ×1 |
| Velocidad de ataques (startup, activo y recuperación) | ×0,8 (más lentos) | ×1 |
| Daño | ×1,3 | ×1 |
| Peso (divide el retroceso recibido) | 1,7 | 1 |
| Poder (O, con energía llena) | Pisotón sísmico: onda por el suelo, más lenta; se esquiva saltando | Canto sónico |
| Súper | Terremoto del Morro | Canto resonante |

Al terminar el tiempo se compara la vida en porcentaje, para que los 125 puntos de César no le den ventaja.

## Arte (versión 1: recorte animado)

Las 23 hojas (4×3, 12 cuadros) salen de una sola ilustración, `WATON MAIN.jpg`, recortada en cabeza, torso, dos antebrazos y dos piernas, y animada por poses clave. Los scripts están en `rig/`:

- `parts.py`: polígonos de cada parte y sus pivotes.
- `rig.py`: recorte, relleno de huecos y composición de una pose.
- `anims.py`: las 23 animaciones como poses clave.
- `build.py out [ANIMACION…]`: genera las hojas de 640×560 por celda, con el suelo en y=530.

Para regenerar: copia la ilustración como `main.jpg` y crea `cesar_rgba.png` con el croma verde quitado (ver el inicio de `rig.py`). Después ejecuta `python3 build.py out` y copia `out/*` a `public/assets/characters/cesar/`. El manifiesto usa `sourceBodyHeight: 456` y `groundY: 530`. Así todas las animaciones comparten una sola escala y el mismo suelo.

## Versión 2: arte dibujado activo

El juego usa ahora 23 hojas redibujadas con ImageGen: 276 cuadros con articulaciones, apoyos, anticipación y recuperación. Están en `public/assets/characters/cesar-v2/`. La versión de recortes anterior se conserva como respaldo.

La dirección visual, prompts finales, procedencia, ajustes de escala y cuadros de impacto están en [../cesar-v2/design.md](../cesar-v2/design.md). `prompts.json` en esta carpeta conserva los prompts preliminares de la versión 1.
