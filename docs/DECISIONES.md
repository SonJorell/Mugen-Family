# Registro de decisiones — Mugen Family

Formato: fecha · contexto · decisión · motivo.

## 2026-11-10 · Aturdimiento de guardia sin escalar por velocidad de ataque
- **Contexto:** `FighterStats.attackSpeed` divide los frames de cada ataque (César es más lento).
- **Decisión:** `blockstun` y `blockPushback` no se escalan con el atacante; el empuje se divide
  por el `weight` del defensor, igual que el retroceso al recibir golpes.
- **Motivo:** el aturdimiento es del defensor. Así los golpes lentos de César quedan más en
  desventaja al ser bloqueados, coherente con un luchador pesado. Es la opción más conservadora:
  no cambia ningún valor existente.

## 2026-11-10 · El reloj del round sigue corriendo durante el hitstop
- **Contexto:** el hitstop congela a los luchadores 50–120 ms por golpe.
- **Decisión:** el reloj del round no se detiene; solo se congelan luchadores, sus temporizadores
  de estado y sus animaciones. El súper anula cualquier hitstop pendiente al empezar.
- **Motivo:** el reloj marca tiempo real de partida, como en los arcades del género; además, así
  el hitstop no cambia la duración de los rounds ni las pruebas de tiempo existentes.

## 2026-11-10 · Dificultad de la CPU por datos y con semilla
- **Contexto:** la CPU rotaba 4 golpes en orden fijo y bloqueaba 1 de cada 3 ataques.
- **Decisión:** tres perfiles en `GAME_CONFIG.CPU_DIFFICULTY`; *Normal* conserva aproximadamente el
  ritmo anterior. Cada ataque entrante se evalúa una sola vez (por `Fighter.attackSerial`), así
  pensar más rápido no regala bloqueos extra. El azar sale de `makeRandom(seed)`: sin semilla en
  el juego, con semilla fija en las pruebas. La dificultad se elige en la selección (X) y viaja
  con los datos de la partida; no se guarda en el navegador.
- **Motivo:** balance editable sin tocar lógica y pruebas deterministas.

## 2026-11-10 · Las 4 pruebas que fallaban
- **Contexto:** se reportaron fallos en `cesar.spec.ts` («César can be picked with E…»),
  `menu-3d.spec.ts` («the title screen starts on a roster fighter…») y las dos «real keyboard
  double jump…» de `super.spec.ts`.
- **Hallazgo:** con el súper de César ya integrado (85f31bf) las cuatro pasan: 20/20 al repetirlas
  5 veces y también en las tandas completas. Ninguna regla del código fallaba; dependen de tiempo
  real. La causa concreta encontrada está en la prueba de César: un `waitForTimeout(200)` entre
  los dos Enter de la selección podía perder el segundo bajo carga.
- **Decisión:** reemplazar esas esperas fijas por esperas al estado de la escena. Las demás no se
  tocan porque ya esperan condiciones del juego, no tiempos fijos.
- **Motivo:** cambio mínimo y solo en pruebas; no se desactiva ni se salta ninguna.

## 2026-11-10 · Escalera del modo arcade
- **Contexto:** el plantel tiene 2 luchadores; una escalera de un solo rival sería muy corta.
- **Decisión:** cada rival del plantel, luego el combate espejo, y como jefe final una revancha
  contra el primer rival en Difícil (mínimo 3 combates, `GAME_CONFIG.ARCADE.MIN_FIGHTS`). La
  dificultad sube de forma pareja de Fácil a Difícil. Los rivales nunca usan el color del jugador.
  Las continuaciones son ilimitadas pero se cuentan y se muestran en el final.
- **Motivo:** escala sola al sumar luchadores en `roster.ts`, sin tocar la lógica.
- **Menú:** «Modo arcade» es la segunda opción; se actualizaron las 4 pruebas que navegaban el menú
  por posición.
