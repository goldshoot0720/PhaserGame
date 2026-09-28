---
manifest:
category: game
title: 萌友格鬥王 Moe Fighters
summary: A cute 2D arcade fighting game — eight chibi fighters with frame-data normals, motion-input specials, meter supers, blocking high/low, best-of-3 rounds vs CPU or a friend.
render: webgpu
---

# 萌友格鬥王
Role: 1P vs CPU (3 difficulties) or 2P local versus fighting game.

## Invariants
- 60 Hz fixed-step simulation (`sim.ts`), startup/active/recovery frame data, hitstop, pushback, combo scaling.
- Hold back to block; lows must be crouch-blocked, overheads stand-blocked; specials chip.
- Specials by motion (↓↘→ / →↓↘ / ↓↙← + P/K) or shortcut; super by double-qcf or shortcut at full meter.
- Best of 3 rounds, 99 s timer, time-out goes to higher health %.

## Blocks Used
- custom `sim.Fight` / `Body`, `moves` frame data, `roster` (8 fighters ported from local Game5), `ai.Cpu`.

## Tuning
| Field | Value |
|---|---|
| ROUND_TIME | 99 |
| ROUNDS_TO_WIN | 2 |
| METER_MAX | 100 |
| GRAVITY / JUMP_VY | 0.8 / −17 px/frame |
| combo scaling | −10% per hit, min 40% |

## Controllers
- 1P: arrows/WASD, Z/J LP, X/K HP, C/U LK, V/I HK, B/L special, N/O super.
- 2P: arrows + , . / ; ' ] (or numpad 1–6).

## Acceptance Tests
- Walk, facing, jab damage + meter, block, low beats standing block, qcf projectile, super gating, KO, parry (verify.ts).
