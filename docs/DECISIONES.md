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
