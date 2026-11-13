# Balance — Tilin vs César

Fuente de los números: `src/combat/AttackDefinition.ts` (golpes base) y `FighterStats` en
`src/config/roster.ts`. César escala sus golpes con `Fighter.scaleAttack`: frames ÷ `attackSpeed`
(redondeado), daño × `damage` (redondeado) y alcance × `size`. Frames a 60 por segundo.

## Atributos

| | Tilin | César |
| --- | ---: | ---: |
| Vida | 100 | 125 |
| Multiplicador de daño | 1 | **1.2** (antes 1.3) |
| Velocidad de ataque | 1 | 0.8 (frames ×1.25) |
| Caminar | 260 px/s | 187 px/s |
| Salto | 820 | 705 |
| Tamaño (alcance y hurtbox) | 1 | 1.14 (hurtbox 103 px de ancho, Tilin 90) |
| Peso (retroceso recibido ÷) | 1 | 1.7 |
| Súper | Canto resonante, 60 de daño | Furia del i30, 60 de daño |

## Golpes

Ventaja = frames que el rival queda bloqueado (aturdido o en guardia) menos frames que le quedan al
atacante, contando el contacto en el primer frame activo. Negativo: el atacante queda expuesto.

| Golpe | Luchador | Inicio / activo / recup. | Daño | Alcance | Ventaja al golpear | Ventaja al bloquear |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Puño suave | Tilin | 2 / 6 / 8 | 5 | 140 | −2 | −1 |
| | César | 3 / 8 / 10 | 6 | 160 | −6 | −5 |
| Puño fuerte | Tilin | 4 / 8 / 14 | 12 | 170 | −4 | −10 |
| | César | 5 / 10 / 18 | 14 | 194 | −10 | −16 |
| Patada suave | Tilin | 3 / 6 / 9 | 6 | 145 | −1 | −2 |
| | César | 4 / 8 / 11 | 7 | 165 | −5 | −6 |
| Patada fuerte | Tilin | 6 / 8 / 16 | 15 | 170 | derriba | −12 |
| | César | 8 / 10 / 20 | 18 | 194 | derriba | −18 |

Los golpes suaves que tocan al rival se cancelan en fuertes (`cancelsInto`), así que el «−2 al
golpear» de un puño suave no se nota si se sigue con un puño fuerte.

## Especiales de comando (↓ ↘ → + puño)

Sin coste de energía. Se pueden cancelar desde un golpe suave que toca al rival.

| Especial | Luchador | Inicio / activo / recup. | Daño | Alcance | Al golpear | Al bloquear | Notas |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| Paso veloz | Tilin | 7 / 8 / 18 | 9 | 150 + avance de ~140 px | −6 (lo aleja el retroceso) | −12 | Cubre distancia; castigable al bloquearse |
| Pisotón sísmico | César | 13 / 8 / 25 | 14 | 182, bajo | derriba | −17 | Lento y muy expuesto si lo bloquean |

La CPU los usa con probabilidad 6 % (Fácil), 15 % (Normal) y 25 % (Difícil) por decisión cuando el
rival está en su rango (`cpuRange`).

## Golpes para ganar un round

| Golpe repetido | Tilin vence a César (125) | César vence a Tilin (100) |
| --- | ---: | ---: |
| Puño suave | 25 | 17 |
| Puño fuerte | 11 | 8 |
| Patada suave | 21 | 15 |
| Patada fuerte | 9 | 6 |
| Combo puño suave → puño fuerte | 8 combos (17 c/u) | 5 combos (20 c/u) |
| Combo suave → patada suave → patada fuerte | 5 combos (26 c/u) | 4 combos (31 c/u) |
| Súper | 48 % de la vida de César | 60 % de la vida de Tilin |
| Especial de comando | 14 Pasos veloces | 8 Pisotones |

César necesita menos golpes, pero cada uno tarda un 25 % más, alcanza 14 % más lejos y deja más
expuesto al ser bloqueado; además ofrece un blanco más grande y camina un 28 % más lento.

## Simulación CPU contra CPU

`node scripts/simulate-balance.mjs [rounds-por-lado] [dificultad]` (con el servidor de desarrollo
encendido) hace pelear a la CPU contra sí misma con semillas fijas, cambiando de lado para que la
posición inicial no pese. Cada round empieza con la vida llena.

| Configuración | Rounds | Tilin gana | César gana |
| --- | ---: | ---: | ---: |
| `damage: 1.3`, Normal | 60 | 43 % | 57 % |
| `damage: 1.3`, Difícil | 60 | 38 % | 62 % |
| **`damage: 1.3`, total** | **120** | **41 %** | **59 %** |
| `damage: 1.2`, Normal | 60 | 42 % | 58 % |
| `damage: 1.2`, Difícil | 60 | 57 % | 43 % |
| **`damage: 1.2`, total** | **120** | **49 %** | **51 %** |
| `damage: 1.2`, Normal (muestra grande) | 120 | 50 % | 50 % |
| `damage: 1.2`, Difícil (muestra grande) | 120 | 57 % | 43 % |
| **`damage: 1.2`, total (muestra grande)** | **240** | **53 %** | **47 %** |
| Con especiales de comando, Normal | 60 | 65 % | 35 % |
| Con especiales de comando, Difícil | 60 | 37 % | 63 % |
| **Con especiales de comando, total** | **120** | **51 %** | **49 %** |

Sin empates ni rounds por tiempo: todos terminaron por K.O. Con 60 rounds por dificultad las
cifras de cada nivel oscilan bastante (y en sentidos opuestos); el total sigue parejo.

## Ajuste

César bajó su multiplicador de daño de 1.3 a 1.2. Motivo y alternativas descartadas en
`docs/DECISIONES.md`. La CPU no aprovecha del todo la velocidad de Tilin (no castiga por frames ni
busca el alcance), así que conviene revisar estas cifras con partidas reales de dos jugadores.
