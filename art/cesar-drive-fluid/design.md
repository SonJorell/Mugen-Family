# Fluidez del i30

Se reemplazan las poses estáticas de César por 32 dibujos nuevos de estilo 3D: 12 para agarre/lanzamiento, 8 para entrar en el auto y 12 para caminar de regreso y brindar. Las hojas originales de ImageGen se conservan sin recortarlas ni repintarlas; el juego crea los fotogramas del atlas al precargar.

Cada hoja usa una escala fija. Se alinea el suelo de cada pose y se compensan los desplazamientos de la hoja de regreso mediante los anclajes registrados en `return-registration.json`. El anclaje horizontal también se refleja al mirar hacia la izquierda. La última pose de abordaje es el mismo dibujo usado para conducir, evitando un cambio de tamaño al cerrar la puerta.

Las trayectorias siguen el reloj del súper: anticipación, lanzamiento parabólico, caída amortiguada, aceleración continua a través del impacto, suspensión del auto y regreso con transferencia de peso. El mismo instante produce exactamente la misma pose, incluso después de pausar o cambiar el tiempo de presentación. Las ruedas giran según la distancia recorrida. El modo de movimiento reducido omite balanceos y sacudidas secundarios.

Se conservan los 5,8 segundos y los impactos de 4, 12 y 44 puntos. El daño y las colisiones siguen bajo la autoridad del sistema de combate.

El render general permite posiciones fraccionarias y filtrado lineal para las ilustraciones. La normalización de los sprites usa remuestreo de alta calidad. No se acelera el reloj de los ataques ni se cambian sus fotogramas activos.

## Recursos y validación

- `prompts.json`: instrucciones y fuentes de las tres hojas generadas con ImageGen integrado.
- `transparency-edit.json`: limpieza adicional del fondo de la hoja de regreso.
- `return-registration.json`: compensaciones por celda, medidas sobre las siluetas.
- `tests/cesar-fluidity.spec.ts`: sucesión de poses, continuidad angular y de velocidad, pausa/seek y espejo verificado sobre píxeles dibujados por Phaser.
- `tests/cesar-drive.spec.ts`: energía, defensa, daño, K.O., pausa, cancelación y posición final.
- `scripts/inspect-drive.mjs` y `scripts/record-drive.mjs`: capturas y grabación con teclado real; `OUTPUT_DIR` permite conservar una comparación con la versión anterior.
