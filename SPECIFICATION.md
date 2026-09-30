# MUGEN Web Fighter --- Sistema Base de Pruebas de Sprites

## 1. Objetivo

Crear un videojuego de peleas 2D para navegador, inspirado en la
estructura y sensación de los clásicos juegos de lucha tipo MUGEN, pero
desarrollado desde cero y preparado para incorporar posteriormente más
personajes, escenarios, ataques, efectos, IA y modos de juego.

La primera versión tendrá:

- 1 personaje jugable.
- 1 escenario de prueba.
- Jugador contra un oponente de prueba.
- Sistema de sprites basado en imágenes generadas mediante sprite
  sheets.
- Animaciones cargadas automáticamente según el nombre de la carpeta y
  archivo.
- Movimiento horizontal.
- Salto.
- Agacharse.
- Ataques básicos.
- Bloqueo.
- Hit reaction.
- Knockdown.
- Get up.
- Barra de vida.
- Temporizador.
- HUD.
- Pantalla de inicio.
- Pantalla de pausa.
- Reinicio de combate.
- Arquitectura preparada para agregar más personajes.

---

# 2. Tecnología

Usar:

- Vite
- TypeScript
- Phaser 3
- HTML5
- CSS
- JavaScript/TypeScript modular

No utilizar un motor 3D.

El juego debe funcionar directamente en navegador mediante:

```bash
npm install
npm run dev
```

Y generar una versión de producción mediante:

```bash
npm run build
```

---

# 3. Concepto visual

El juego debe tener una presentación profesional de fighting game 2D.

Inspiración funcional:

- MUGEN
- juegos arcade de lucha 2D
- interfaces de fighting games clásicos

No copiar personajes, escenarios, logos ni recursos protegidos de otros
juegos.

El sistema visual debe priorizar:

- pixel art
- sprites nítidos
- ausencia de blur
- ausencia de interpolación visual
- escalado entero cuando sea posible
- animaciones fluidas
- HUD claramente visible
- escenario con profundidad visual
- efectos de impacto posteriormente ampliables

La cámara debe permanecer en perspectiva lateral 2D.

---

# 4. Estructura principal del proyecto

```text
mugen-web-fighter/
│
├── public/
│   ├── assets/
│   │   ├── characters/
│   │   │   └── player/
│   │   │       ├── IDLE/
│   │   │       │   ├── IDLE_1.png
│   │   │       │   └── IDLE_2.png
│   │   │       │
│   │   │       ├── WALK_FORWARD/
│   │   │       │   ├── WALK_FORWARD_1.png
│   │   │       │   └── WALK_FORWARD_2.png
│   │   │       │
│   │   │       ├── WALK_BACKWARD/
│   │   │       ├── DASH/
│   │   │       ├── CROUCH/
│   │   │       ├── JUMP/
│   │   │       ├── LIGHT_PUNCH/
│   │   │       ├── HEAVY_PUNCH/
│   │   │       ├── LIGHT_KICK/
│   │   │       ├── HEAVY_KICK/
│   │   │       ├── BLOCK/
│   │   │       ├── HIT_REACTION/
│   │   │       ├── KNOCKDOWN/
│   │   │       ├── GET_UP/
│   │   │       ├── TAUNT/
│   │   │       ├── VICTORY/
│   │   │       ├── DEFEAT/
│   │   │       └── SPECIAL_ATTACK/
│   │   │
│   │   ├── stages/
│   │   │   └── training/
│   │   │
│   │   ├── effects/
│   │   ├── ui/
│   │   └── audio/
│   │
│   └── config/
│       └── characters/
│
├── src/
│   ├── main.ts
│   │
│   ├── config/
│   │   └── gameConfig.ts
│   │
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── PreloadScene.ts
│   │   ├── MenuScene.ts
│   │   ├── CharacterTestScene.ts
│   │   ├── FightScene.ts
│   │   └── PauseScene.ts
│   │
│   ├── characters/
│   │   ├── Fighter.ts
│   │   ├── PlayerFighter.ts
│   │   ├── TrainingOpponent.ts
│   │   └── CharacterDefinition.ts
│   │
│   ├── animation/
│   │   ├── SpriteSheetLoader.ts
│   │   ├── AnimationRegistry.ts
│   │   └── AnimationDefinition.ts
│   │
│   ├── combat/
│   │   ├── CombatState.ts
│   │   ├── Hitbox.ts
│   │   ├── Hurtbox.ts
│   │   ├── AttackDefinition.ts
│   │   └── CollisionSystem.ts
│   │
│   ├── input/
│   │   ├── InputManager.ts
│   │   └── InputMapping.ts
│   │
│   ├── ui/
│   │   ├── HUD.ts
│   │   ├── HealthBar.ts
│   │   ├── Timer.ts
│   │   └── FightMessages.ts
│   │
│   ├── systems/
│   │   ├── FighterController.ts
│   │   ├── PhysicsSystem.ts
│   │   ├── FacingSystem.ts
│   │   └── RoundSystem.ts
│   │
│   └── utils/
│       ├── AssetUtils.ts
│       └── DebugUtils.ts
│
├── README.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

# 5. Sistema de sprites

## Regla fundamental

Cada imagen generada contiene exactamente **3 sprites individuales**.

Ejemplo:

```text
IDLE_1.png
```

contiene:

```text
┌────────────┬────────────┬────────────┐
│   Frame 1  │   Frame 2  │   Frame 3  │
└────────────┴────────────┴────────────┘
```

Mientras:

```text
IDLE_2.png
```

contiene:

```text
┌────────────┬────────────┬────────────┐
│   Frame 4  │   Frame 5  │   Frame 6  │
└────────────┴────────────┴────────────┘
```

Por lo tanto:

```text
IDLE/
├── IDLE_1.png → frames 1, 2, 3
└── IDLE_2.png → frames 4, 5, 6
```

El juego debe dividir automáticamente cada imagen en **3 columnas
iguales**.

No se deben considerar los 3 sprites como una sola imagen.

---

# 6. Convención de nombres

La estructura de nombres será:

```text
NOMBRE_ANIMACION/
    NOMBRE_ANIMACION_1.png
    NOMBRE_ANIMACION_2.png
    NOMBRE_ANIMACION_3.png
    ...
```

Ejemplo:

```text
IDLE/
    IDLE_1.png
    IDLE_2.png

WALK_FORWARD/
    WALK_FORWARD_1.png
    WALK_FORWARD_2.png

JUMP/
    JUMP_1.png
    JUMP_2.png
    JUMP_3.png
```

El número del archivo indica el bloque de frames.

Cada archivo siempre contiene 3 frames.

---

# 7. Conversión de archivo a frames

El sistema debe implementar un cargador reutilizable.

Ejemplo conceptual:

```text
IDLE_1.png
       ↓
divide en 3
       ↓
Frame 1
Frame 2
Frame 3
```

Luego:

```text
IDLE_2.png
       ↓
divide en 3
       ↓
Frame 4
Frame 5
Frame 6
```

Resultado interno:

```text
IDLE = [
    frame1,
    frame2,
    frame3,
    frame4,
    frame5,
    frame6
]
```

El código debe ser capaz de ordenar los archivos numéricamente.

Por ejemplo:

```text
IDLE_1.png
IDLE_2.png
IDLE_10.png
```

debe interpretarse como:

```text
1
2
10
```

y no:

```text
1
10
2
```

---

# 8. Fondo chroma

Las imágenes de sprites fueron generadas sobre:

```text
#00FF00
```

El sistema debe convertir el fondo verde en transparencia.

El personaje debe quedar con canal alpha.

Importante:

- no eliminar colores verdes que formen parte real del personaje;
- aplicar tolerancia configurable;
- permitir ajustar el rango de chroma;
- mantener intactos los píxeles del personaje.

Crear una utilidad:

```text
removeChromaBackground()
```

con parámetros configurables.

---

# 9. Escala y alineación

Todos los frames de una animación deben mantener:

- misma escala visual;
- mismo tamaño lógico;
- misma posición respecto al suelo;
- mismo punto de origen;
- misma orientación;
- misma proporción.

Crear un sistema de:

```text
Fighter Anchor
```

para que los sprites se posicionen correctamente.

El punto de referencia principal será:

```text
bottom-center
```

del personaje.

Esto evita que el personaje parezca saltar hacia arriba o abajo
simplemente porque cambió de pose.

---

# 10. Interpolación de sprites

Desactivar suavizado de imágenes cuando corresponda.

Utilizar:

```text
pixelArt: true
```

y configurar Phaser para mantener los píxeles nítidos.

No utilizar:

- blur;
- suavizado excesivo;
- filtros que deformen el pixel art.

---

# 11. Animaciones iniciales

El sistema debe reconocer automáticamente estas animaciones:

```text
IDLE
WALK_FORWARD
WALK_BACKWARD
DASH
CROUCH
JUMP
LIGHT_PUNCH
HEAVY_PUNCH
LIGHT_KICK
HEAVY_KICK
BLOCK
HIT_REACTION
KNOCKDOWN
GET_UP
TAUNT
VICTORY
DEFEAT
SPECIAL_ATTACK
```

Si alguna carpeta todavía no existe, el juego **no debe romperse**.

Debe mostrar:

```text
Animation not available
```

solamente en modo debug, y continuar utilizando las animaciones
disponibles.

---

# 12. Sistema de estados del personaje

Crear una máquina de estados.

Estados mínimos:

```text
IDLE
WALKING_FORWARD
WALKING_BACKWARD
DASHING
CROUCHING
JUMPING
ATTACKING
BLOCKING
HIT
KNOCKED_DOWN
GETTING_UP
TAUNTING
VICTORY
DEFEAT
SPECIAL
```

El personaje no debe ejecutar dos estados incompatibles simultáneamente.

Por ejemplo:

```text
ATTACKING
```

debe impedir temporalmente:

```text
WALKING
JUMPING
```

según la definición del ataque.

---

# 13. Controles

Usar teclado.

## Movimiento

```text
A / ←  = mover hacia atrás
D / →  = mover hacia adelante
W / ↑  = saltar
S / ↓  = agacharse
```

## Ataques

```text
J = Light Punch
K = Heavy Punch

U = Light Kick
I = Heavy Kick
```

## Defensa

```text
L = Block
```

## Especial

```text
O = Special Attack
```

## Taunt

```text
P = Taunt
```

Crear también una capa de configuración para poder cambiar
posteriormente estas teclas.

---

# 14. Sistema de orientación

El personaje debe mirar siempre hacia el oponente.

Implementar:

```text
FacingSystem
```

El sistema debe determinar:

```text
opponent.x > player.x
```

o

```text
opponent.x < player.x
```

y voltear el sprite horizontalmente cuando corresponda.

Nunca modificar permanentemente la imagen original.

Utilizar:

```text
setFlipX()
```

o equivalente.

---

# 15. Movimiento

Implementar:

- desplazamiento lateral;
- aceleración opcional;
- velocidad máxima;
- frenado;
- salto;
- gravedad;
- aterrizaje;
- límites del escenario.

El personaje no puede salir de los límites visibles de la arena.

---

# 16. Sistema de combate

Crear una arquitectura preparada para:

```text
Hitbox
Hurtbox
Damage
Block
Hitstun
Knockback
Recovery
Attack startup
Active frames
Recovery frames
```

Cada ataque debe tener una definición independiente.

Ejemplo:

```ts
{
    name: "LIGHT_PUNCH",
    damage: 5,
    startup: 3,
    active: 4,
    recovery: 8,
    hitstun: 10,
    knockback: 80
}
```

Los valores pueden ser temporales y fácilmente modificables.

---

# 17. Hitboxes

No utilizar solamente la imagen del personaje para detectar golpes.

Separar:

```text
Hurtbox
```

de:

```text
Hitbox
```

En modo debug debe existir una opción:

```text
SHOW_HITBOXES = true
```

que muestre:

- hurtboxes;
- hitboxes;
- punto de anclaje;
- posición del personaje.

Las hitboxes deben poder modificarse sin alterar los sprites.

---

# 18. Personaje de prueba

Inicialmente existirán:

```text
PLAYER
```

y:

```text
TRAINING_DUMMY
```

El segundo puede utilizar temporalmente el mismo personaje y sprites.

No crear todavía un segundo personaje real.

El objetivo es probar el sistema de sprites y combate.

---

# 19. Training Dummy

El oponente inicial debe permitir probar:

- ataques;
- daño;
- bloqueo;
- hit reaction;
- knockdown;
- get up.

Inicialmente puede permanecer quieto.

Agregar posteriormente una IA.

---

# 20. Barra de vida

Crear HUD estilo arcade.

Debe mostrar:

```text
PLAYER NAME                         DUMMY
████████████████████      ████████████████████
```

La vida inicial:

```text
100
```

La barra debe disminuir visualmente al recibir daño.

No utilizar números gigantes en pantalla.

---

# 21. Temporizador

Mostrar:

```text
99
```

en el centro superior.

El temporizador debe:

- comenzar al iniciar el round;
- disminuir progresivamente;
- detenerse durante pausa;
- terminar el round al llegar a 0.

---

# 22. Sistema de rounds

Primera versión:

```text
ROUND 1
```

Mostrar brevemente:

```text
ROUND 1
```

Después:

```text
FIGHT!
```

y comenzar el combate.

Preparar arquitectura para:

```text
ROUND 2
ROUND 3
```

aunque inicialmente puede existir solamente un round.

---

# 23. Pantalla de prueba

Crear una pantalla denominada:

```text
CharacterTestScene
```

Esta pantalla debe ser especialmente útil para revisar los sprites.

Mostrar:

```text
PLAYER
```

en el centro.

Agregar un pequeño panel debug:

```text
CURRENT ANIMATION: IDLE
CURRENT FRAME: 1
FPS: 60
POSITION: X / Y
```

Y controles para cambiar manualmente la animación.

Por ejemplo:

```text
1 = IDLE
2 = WALK_FORWARD
3 = WALK_BACKWARD
4 = DASH
5 = CROUCH
6 = JUMP
7 = LIGHT_PUNCH
8 = HEAVY_PUNCH
9 = LIGHT_KICK
0 = HEAVY_KICK
```

Esto permitirá probar cada sprite sin iniciar una pelea.

---

# 24. Selector de animación de prueba

Crear una función:

```ts
playAnimation("IDLE")
```

y permitir:

```ts
playAnimation("WALK_FORWARD")
playAnimation("WALK_BACKWARD")
playAnimation("DASH")
playAnimation("CROUCH")
playAnimation("JUMP")
playAnimation("LIGHT_PUNCH")
playAnimation("HEAVY_PUNCH")
playAnimation("LIGHT_KICK")
playAnimation("HEAVY_KICK")
playAnimation("BLOCK")
playAnimation("HIT_REACTION")
playAnimation("KNOCKDOWN")
playAnimation("GET_UP")
playAnimation("TAUNT")
playAnimation("VICTORY")
playAnimation("DEFEAT")
playAnimation("SPECIAL_ATTACK")
```

---

# 25. Velocidad de animación

No asumir que todas las animaciones tienen la misma velocidad.

Cada animación debe permitir:

```ts
frameRate
repeat
repeatDelay
```

Ejemplo:

```ts
IDLE:
    frameRate: 6
    repeat: -1

WALK_FORWARD:
    frameRate: 10
    repeat: -1

LIGHT_PUNCH:
    frameRate: 12
    repeat: 0
```

Los valores deben estar centralizados para modificarlos fácilmente.

---

# 26. Animaciones que no deben repetirse

Por defecto:

```text
IDLE → loop
WALK_FORWARD → loop
WALK_BACKWARD → loop
DASH → no loop
CROUCH → loop/hold
JUMP → no loop
LIGHT_PUNCH → no loop
HEAVY_PUNCH → no loop
LIGHT_KICK → no loop
HEAVY_KICK → no loop
BLOCK → hold
HIT_REACTION → no loop
KNOCKDOWN → no loop
GET_UP → no loop
TAUNT → no loop
VICTORY → loop suave o hold
DEFEAT → hold
SPECIAL_ATTACK → no loop
```

---

# 27. Escenario inicial

Crear un escenario de entrenamiento simple.

Debe contener:

- suelo;
- fondo;
- iluminación;
- profundidad;
- límite izquierdo;
- límite derecho.

No utilizar todavía assets complejos.

Puede utilizarse un escenario generado mediante formas, gradientes y
elementos simples mientras se prueban los personajes.

La prioridad actual son los sprites.

---

# 28. Cámara

La cámara debe:

- seguir el área de combate;
- mantener ambos personajes visibles;
- impedir que los luchadores salgan de la zona jugable;
- utilizar zoom configurable.

Variables:

```ts
cameraZoom
stageWidth
stageHeight
cameraMinX
cameraMaxX
```

---

# 29. Arquitectura preparada para múltiples personajes

No codificar el personaje directamente dentro de la escena.

Utilizar:

```text
CharacterDefinition
```

Ejemplo conceptual:

```ts
{
    id: "player",
    name: "Player",
    assetPath: "/assets/characters/player/",
    animations: {
        IDLE: {...},
        WALK_FORWARD: {...},
        WALK_BACKWARD: {...}
    }
}
```

En el futuro se podrá agregar:

```text
characters/
├── player/
├── character_02/
├── character_03/
└── boss/
```

sin reescribir el sistema de combate.

---

# 30. Carga de assets

No asumir manualmente que existen todos los archivos.

El sistema debe comprobar qué recursos existen.

Si:

```text
SPECIAL_ATTACK/
```

todavía no existe, continuar funcionando.

La aplicación debe mostrar errores claros en consola, por ejemplo:

```text
[SpriteLoader] Animation SPECIAL_ATTACK not found.
```

pero no detener todo el juego.

---

# 31. Sistema de registro de animaciones

Crear:

```text
AnimationRegistry
```

que almacene:

```text
animation name
frame list
frame rate
loop
anchor
scale
```

Ejemplo:

```ts
AnimationDefinition {
    name: string;
    frames: string[];
    frameRate: number;
    loop: boolean;
    repeat: number;
}
```

---

# 32. Precarga

Crear una escena:

```text
PreloadScene
```

que cargue:

- sprites;
- escenario;
- UI;
- efectos;
- audio cuando existan.

Mostrar una pequeña barra de carga.

---

# 33. Manejo de errores

El juego nunca debe quedar en pantalla negra por faltar un sprite.

Implementar fallback:

```text
missing sprite
```

y utilizar:

```text
IDLE
```

cuando una animación solicitada no exista.

En desarrollo, mostrar el error en consola.

---

# 34. Menú inicial

Crear:

```text
START
```

```text
TRAINING
```

```text
OPTIONS
```

Inicialmente:

- START → FightScene
- TRAINING → CharacterTestScene
- OPTIONS → configuración básica

No es necesario implementar todas las opciones todavía.

---

# 35. Pausa

Tecla:

```text
ESC
```

debe abrir:

```text
PAUSED
```

con:

```text
RESUME
RESTART
MAIN MENU
```

El combate y las animaciones deben detenerse correctamente durante la
pausa.

---

# 36. Calidad de código

El código debe ser:

- TypeScript;
- modular;
- mantenible;
- tipado;
- sin duplicación innecesaria;
- con nombres claros;
- separado por responsabilidades.

No crear un único archivo gigante.

---

# 37. Requisito importante de sprites

El sistema debe asumir que cada archivo:

```text
*_1.png
*_2.png
*_3.png
```

es un sprite sheet horizontal de exactamente 3 frames.

Ejemplo:

```text
LIGHT_PUNCH/
├── LIGHT_PUNCH_1.png
└── LIGHT_PUNCH_2.png
```

Debe convertirse automáticamente en:

```text
LIGHT_PUNCH:
[
    frame_01,
    frame_02,
    frame_03,
    frame_04,
    frame_05,
    frame_06
]
```

No pedir al usuario que recorte manualmente las imágenes.

---

# 38. Orden de implementación

Implementar en este orden:

## Fase 1

- Vite
- TypeScript
- Phaser
- estructura del proyecto
- configuración básica

## Fase 2

- SpriteSheetLoader
- lectura de carpetas
- lectura de nombres
- división automática en 3 frames
- chroma key
- transparencia

## Fase 3

- Fighter
- AnimationRegistry
- IDLE
- WALK
- JUMP

## Fase 4

- controles
- movimiento
- gravedad
- orientación

## Fase 5

- ataques
- hitboxes
- hurtboxes
- daño

## Fase 6

- HUD
- vida
- timer
- rounds

## Fase 7

- CharacterTestScene
- debug
- selector de animaciones

## Fase 8

- menú
- pausa
- escenario
- pulido visual

---

# 39. Requisito de prueba

Al ejecutar:

```bash
npm run dev
```

debe ser posible:

1. Abrir el juego en el navegador.
2. Ver el personaje.
3. Ver la animación IDLE.
4. Caminar.
5. Retroceder.
6. Saltar.
7. Agacharse.
8. Ejecutar ataques.
9. Ver correctamente los frames.
10. Ver al personaje mirando al oponente.
11. Ver la barra de vida.
12. Golpear al dummy.
13. Ver hit reaction.
14. Ver knockdown.
15. Ver get up.
16. Abrir la pantalla de prueba.
17. Cambiar manualmente entre animaciones.
18. Ver el número de frame actual.

---

# 40. Debug obligatorio

Crear configuración:

```ts
DEBUG_MODE = true;
```

Cuando esté activo mostrar:

```text
Animation: IDLE
Frame: 3/6
FPS: 60
State: IDLE
Position: 540, 420
Facing: RIGHT
```

También permitir:

```text
SHOW_HITBOXES
SHOW_HURTBOXES
SHOW_ANCHOR
SHOW_DEBUG_TEXT
```

---

# 41. Preparación para futuro sistema MUGEN-like

La arquitectura debe quedar preparada para incorporar posteriormente:

- múltiples personajes;
- selección de personaje;
- selección de escenario;
- versus;
- IA;
- combos;
- ataques normales;
- ataques especiales;
- supers;
- proyectiles;
- throws;
- blockstun;
- hitstun;
- guard damage;
- knockback;
- air attacks;
- crouching attacks;
- command inputs;
- combos;
- cancelaciones;
- frame data;
- efectos;
- sonido;
- música;
- announcer;
- rounds;
- victoria;
- derrota;
- ranking;
- configuración;
- controles personalizados.

No implementar todo ahora.

La prioridad es construir una base sólida.

---

# 42. Regla de diseño

No utilizar lógica específica como:

```ts
if (animation === "IDLE") ...
if (animation === "IDLE_1") ...
```

para cada sprite individual.

El sistema debe ser genérico.

Debe funcionar igualmente con:

```text
IDLE
WALK_FORWARD
SPECIAL_ATTACK
CROUCH
```

sin modificar el código principal.

---

# 43. Resultado esperado

La primera versión debe sentirse como un **prototipo real de un fighting
game 2D profesional**, no como una simple página que muestra imágenes.

Debe existir:

```text
MENÚ
   ↓
TRAINING / FIGHT
   ↓
ESCENARIO
   ↓
PERSONAJE
   ↓
MOVIMIENTO
   ↓
ANIMACIONES
   ↓
COMBATE
   ↓
HUD
```

La arquitectura debe permitir reemplazar posteriormente los sprites de
prueba por los sprites finales sin modificar el motor.

---

# 44. Criterio final de aceptación

El proyecto será considerado correctamente implementado cuando:

- Las imágenes se carguen desde las carpetas.
- El nombre de la carpeta determine la animación.
- El número del archivo determine el bloque de frames.
- Cada imagen se divida automáticamente en 3 sprites.
- Los frames aparezcan en el orden correcto.
- El fondo #00FF00 se convierta correctamente en transparencia.
- Los sprites no tengan bordes verdes visibles.
- El personaje conserve una posición estable sobre el suelo.
- Las animaciones funcionen sin saltos artificiales.
- El personaje pueda moverse y atacar.
- El sistema de combate funcione con un dummy.
- El HUD funcione.
- El modo debug permita revisar los frames.
- Una animación faltante no rompa el juego.
- Agregar una nueva carpeta de animación no requiera reescribir el
  motor.
- Agregar posteriormente otro personaje sea posible mediante una nueva
  carpeta y definición.

---

# 45. Regla para agregar nuevos sprites posteriormente

Para agregar una nueva animación, simplemente crear:

```text
NUEVA_ANIMACION/
    NUEVA_ANIMACION_1.png
    NUEVA_ANIMACION_2.png
```

Cada PNG debe contener:

```text
3 frames horizontales
```

El motor debe poder detectarla y registrarla sin modificar el sistema
principal.

Esto permitirá construir progresivamente el personaje hasta tener un
moveset completo.
