---
manifest:
category: game
title: 萌友瘋狂坦克 Moe Tank Wars
summary: Four-tank free-for-all artillery — destructible heightmap terrain, wind, water, supply drops; three shared shells plus a unique special per driver. Last tank standing wins.
render: webgpu
---

# 萌友瘋狂坦克
Role: You vs three AI tanks, one shot per turn.

## Invariants
- Heightmap terrain; explosions carve round craters (drill digs 2.4× deeper); tanks fall to the new surface (fall damage past 50 px) and drown below the waterline.
- Wind changes every turn and pushes shells horizontally (lasers ignore wind and gravity).
- Hold Space to charge power 0→100, release to fire; 25 s turn clock; limited fuel for driving.
- Specials: wave (knock-back), freeze (skip next turn), laser, 5-way spread, drill, heal +40, cluster (splits at apex), teleport.

## Blocks Used
- custom: terrain + ballistics + AI search (src/rules.ts), battle state machine (src/scenes/play.ts), shared UI helpers; engine fx particles, camera shake, synth SFX.

## Tuning
| Field | Value |
|---|---|
| Field | 2400 × 720, water at 690 |
| Gravity | 520 |
| Speed per power | 9.2 |
| Wind | ±10, ×9 accel |
| HP | 100 |
| Fuel | 120 px per turn |
| Turn time | 25 s |
| Crate | 30% per turn, +30 HP |

## Controllers
- A/D drive, W/S elevation, hold/release Space fire, 1–4 weapons, Q/E pan, Esc quit. AI searches elevation×power with wind and never targets its own blast.

## Acceptance Tests
- See src/verify.ts: terrain, spawns, craters, drill, launch vectors, wind drift, direct hits, damage falloff, fall damage, cliffs, AI accuracy both directions, standings.
