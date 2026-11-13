# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones según
[SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Cambiado
- Carga más rápida: las imágenes del juego se sirven en WebP (95,4 → 37,1 MB al arrancar; con
  20 Mbit/s, de 45 s a 21 s hasta el menú). Pantalla de carga nueva con progreso real.

## [0.2.0] — 2026-11-10

### Añadido
- **Modo arcade** en el menú principal: escalera contra cada rival, el combate espejo y un jefe
  final, de Fácil a Difícil; continuar tras perder; final propio de cada luchador y créditos con
  la procedencia del arte y la música.
- **Dos jugadores locales**: «Rival: Jugador 2» en la selección. J1 con WASD + J K U I L O P;
  J2 con flechas + Insert/Inicio/Supr/Fin/RePág/AvPág o teclado numérico. Soporte de **mandos**
  (mando 1 → J1, mando 2 → J2).
- **Reasignar teclas** de J1 y J2 en Configuración, con detección de repetidas y reservadas,
  guardado en el navegador y «Restaurar valores».
- **Dificultad de la CPU** (Fácil, Normal, Difícil) con tecla X en la selección.
- **Combos**: los golpes suaves que tocan al rival se cancelan en fuertes; contador «N HITS» con
  el daño total.
- **Sensación de impacto**: hitstop de 55 a 120 ms, sacudida de cámara en golpes fuertes y chispas
  distintas para golpe y bloqueo.
- **Bloqueo con consecuencia**: aturdimiento de guardia y empuje; los golpes fuertes bloqueados
  dejan al atacante expuesto.
- **Lista de movimientos** en la pausa, con las teclas de cada jugador y el poder de cada luchador.
- **Herramientas de práctica** en la pausa del modo práctica: visor de entradas, datos de frames y
  vida que se recupera.
- `docs/BALANCE.md` y `scripts/simulate-balance.mjs` (CPU contra CPU).
- ESLint con typescript-eslint (`npm run lint`), integración continua en GitHub Actions y flujo de
  publicación manual en GitHub Pages.
- `docs/DECISIONES.md` con las decisiones de diseño y técnicas.

### Cambiado
- César pega un 20 % más fuerte en vez de un 30 %: ganaba el 59 % de los rounds CPU contra CPU y
  ahora el 47 %.
- El menú principal tiene cuatro opciones; Configuración suma la sección Controles.
- La CPU evalúa cada ataque entrante una vez, también cuando el jugador encadena golpes sin pausa.

### Corregido
- La prueba de selección de César ya no depende de esperas fijas entre pantallas.

## [0.1.0] — 2026-11-09

### Añadido
- Combate 2D con Tilin y César, cuatro colores por luchador y seis escenarios (tres de Arica).
- Súpers cinemáticos: Canto resonante (Tilin) y Furia del i30 (César).
- Combate al mejor de 3 rounds, búfer de entradas, doble salto, CPU y muñeco de práctica.
- Menú con efecto 3D, selector animado, HUD épico, música y efectos sintetizados.
- Galería de movimientos y Configuración (pantalla completa y audio).
