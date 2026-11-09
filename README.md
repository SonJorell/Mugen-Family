# Fighter Family

Juego de pelea 2D para navegador con Phaser 3, TypeScript y Vite. Incluye sprites nuevos de Tilin, canto sónico, música original y un menú con vista del escenario. Los recursos originales se conservan como respaldo.

## Ejecutar

Requiere Node.js 22 o posterior y npm.

```sh
npm ci
npm run dev
```

Abrir http://localhost:3000. El juego está pensado para teclado. El lienzo se adapta al tamaño de la ventana; no se han incorporado controles táctiles ni multijugador.

## Modos y escenarios

**Elegir luchadores** abre el selector arcade. El plantel actual contiene a Tilin con cuatro variantes de color: Original, Amatista, Menta y Coral. Puedes elegir un color independiente para ti y para el rival. Las variantes mantienen los mismos movimientos y estadísticas.

1. Selecciona los colores con el ratón o con ← / → (A / D). Tab o ↑ / ↓ cambia entre jugador y rival. El botón central alterna CPU y práctica.
2. Confirma con Enter o **Elegir escenario**. Hay seis arenas en dos filas: las miniaturas y ← / → cambian de escenario; ↑ / ↓ o W / S cambian de fila.
3. Pulsa **¡A pelear!** o Enter: se muestra el versus y comienza el combate. Esc permite volver atrás, incluso durante el versus.

Las elecciones se conservan al volver al menú y reiniciar. **Cambiar selección**, en el menú de pausa, permite modificar el enfrentamiento. El acceso **Escenario** del menú principal abre directamente la selección de arena.

- **CPU:** rival que se acerca, alterna ataques y bloquea con intervalos de reacción.
- **Muñeco de práctica:** rival pasivo para practicar movimiento, alcance y ataques.
- **Galería de movimientos:** previsualización de las animaciones; no es el modo de combate.
- **Escenarios de Arica:** Costanera del Morro al atardecer, Playa Chinchorro y Catedral San Marcos en Plaza Colón al anochecer.
- **Escenarios originales:** Arena Urbana Nocturna, Templo Antiguo y Azotea de Rascacielos.

La portada muestra una costa de Arica y una ilustración de Tilin con aspecto 3D, título en relieve y capas que responden suavemente al puntero. Las opciones permanecen inmóviles. La preferencia del navegador **Reducir movimiento** desactiva tanto el desplazamiento ambiental como la respuesta al puntero, incluso si cambia con el menú abierto.

Las cinco imágenes originales de esta ampliación se generaron con ImageGen integrado y están en `public/assets/menu/` y `public/assets/stages/arica/`. Prompts, procedencia y referencias de los lugares: `art/arica/`. Los escenarios son interpretaciones artísticas adaptadas al combate; la portada combina ilustraciones en capas, sin introducir un motor de geometría 3D.

Las partidas duran 99 segundos y terminan por K.O. o tiempo. Un empate no asigna un ganador. La pausa detiene también las animaciones y los temporizadores; perder el foco de la ventana pausa automáticamente. Reiniciar conserva el rival y el escenario elegidos.

## Controles

| Acción | Teclas |
| --- | --- |
| Moverse | A / D o flechas izquierda / derecha |
| Saltar / doble salto | W o flecha arriba; volver a pulsar en el aire |
| Agacharse | S o flecha abajo |
| Puño suave / fuerte | J / K |
| Patada suave / fuerte | U / I |
| Bloquear de frente | L |
| Canto sónico | O |
| Activar / silenciar música | M o botón de música |
| Volumen de música | , / . o botones − / + |
| Provocar | P |
| Pausa | Esc o botón de pantalla |
| Ver colisiones | F1 |
| Cambiar escenario | F2 |
| Pantalla completa | F11 o menú |

En el menú: flechas o W/S para elegir, Enter para confirmar. En el selector: A/D o ←/→ para cambiar color o escenario, Tab para cambiar de lado, Enter para avanzar y Esc para retroceder. En la galería: flechas para recorrer animaciones, 1–0 para selección directa, A para girar, F2 para cambiar fondo y Esc para volver.

El segundo salto permite superar la altura del rival y cambiar de lado manteniendo A/D o las flechas. Hay un máximo de dos saltos por vuelo; se recuperan al aterrizar. Mantener la tecla pulsada no activa saltos adicionales. La CPU también puede usar el doble salto; el muñeco de práctica sigue siendo pasivo.

Los impactos tienen cuatro sonidos originales: suave, fuerte, especial y bloqueo. Solo se reproducen al conectar, una vez por golpe; los ataques que fallan o alcanzan a un personaje invulnerable no suenan. El navegador habilita el audio al interactuar con el juego. Los WAV están en `public/assets/audio/` y se pueden regenerar con `node scripts/generate-sounds.mjs`.

## Canto y música

**O** inicia el canto de Tilin. Tras 0,2 segundos libera una onda que viaja hacia delante, inflige 20 puntos de daño y aturde durante 1,75 segundos. Durante el aturdimiento no se puede saltar ni atacar. El canto tiene 2,6 segundos de recarga, indicada debajo de la vida. Un bloqueo frontal reduce el daño a 2 puntos y evita el aturdimiento. Se puede esquivar saltando; la onda desaparece al impactar o al agotar su alcance. Interrumpir la preparación impide que salga la onda. La CPU también usa este poder.

La música original tiene dos arreglos en bucle: menú a 96 BPM y combate a 128 BPM. La pausa detiene la música del combate; al cambiar de escena no se superponen pistas. **M** silencia solo la música, manteniendo audibles los golpes y el canto. El volumen y la preferencia se guardan localmente. `node scripts/generate-music.mjs` regenera las dos pistas y el efecto vocal sintetizado, sin grabaciones externas.

## Verificar

```sh
npx playwright install chromium
npm test
npm run check
npm run build
npm audit
```

Las pruebas ejecutan el juego real en Chromium: controles al cambiar de lado, interrupción de ataques, tiempos de recuperación, caídas sin animación GET_UP, colisiones, bloqueo frontal, daño único por golpe, CPU, práctica, empate, pausa, reinicio, retorno al menú, reapertura de galería, carga fallida y adaptación de pantalla. La instrumentación queda en las pruebas, fuera de la aplicación.

`npm test` inicia Vite automáticamente si no hay servidor en el puerto 3000. `npm run test:ui` abre el explorador de pruebas.

Para una comprobación visual adicional, con el servidor activo:

```sh
node scripts/inspect.mjs
node scripts/inspect-sprites.mjs
node scripts/inspect-sonic.mjs
node scripts/inspect-arica.mjs
```

Las capturas se guardan en `artifacts/` y el script falla ante errores de ejecución o de recursos. Puede apuntarse a otro servidor con la variable `GAME_URL`.

## Compilar y servir

```sh
npm run build
npm run preview
```

Servir `dist/` mediante HTTP desde la raíz del sitio. No abrir `index.html` como archivo local. Phaser aporta la mayor parte del bundle; Vite puede mostrar un aviso de tamaño, sin impedir la compilación.

## Recursos y animaciones

El manifiesto activo contiene **23 animaciones de 12 cuadros: 276 cuadros**. A las hojas de `public/assets/characters/tilin-v2/` se suman seis hojas en `public/assets/characters/tilin-v3/`: canto (sustituye el antiguo especial), aturdimiento, puño aéreo, patada aérea, segundo salto y aterrizaje. Las animaciones aéreas se activan con los mismos botones de ataque mientras se salta; aterrizar reproduce una recuperación breve que se puede cancelar moviéndose o saltando.

Las hojas se generaron mediante ImageGen integrado usando a Tilin como referencia. Los prompts completos, la procedencia y la dirección visual están en `art/tilin-v2/` y `art/tilin-v3/`. La nueva tanda contiene 72 cuadros, de los cuales 60 amplían la biblioteca y 12 sustituyen el especial anterior.

El manifiesto activo sigue en `public/assets/characters/tilin/manifest.json`. Declara la cuadrícula 4×3, velocidades y cuadros de impacto. El cargador conserva la transparencia original, busca los espacios transparentes entre cuadros, normaliza la escala y alinea el suelo. Ambos luchadores comparten las texturas procesadas. Los ataques sincronizan sus poses de anticipación, impacto y recuperación con los tiempos de combate.

Los JPG originales permanecen intactos. El manifiesto anterior está respaldado en `art/tilin-v2/original-manifest.json`; el cargador mantiene compatibilidad con sus hojas de tres cuadros y fondo verde. Si falta `GET_UP`, la recuperación conserva su alternativa segura. Si falla la descarga de recursos, se muestra una opción para reintentar.

`inspect-sprites.mjs` necesita el servidor de desarrollo en el puerto 3000. Guarda capturas, hojas de contacto y mediciones de los 276 cuadros en `artifacts/tilin-v2/`, y falla si encuentra cuadros vacíos, transparencia ausente, recortes en los bordes o errores de ejecución. `inspect-sonic.mjs` guarda vistas del menú, la onda y el aturdimiento en `artifacts/tilin-v3/`.
