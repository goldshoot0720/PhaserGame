---
manifest:
category: game
title: 萌友戰棋・八方對決 Moe Tactics
summary: A Fire-Emblem-style 4v4 turn-based tactics game — move across terrain, attack with range and counters, heal, and outwit an AI army on three maps.
render: webgpu
---

# 萌友戰棋
Role: Single-player turn-based tactics (rules ported from the local Game6).

## Invariants
- Terrain move cost / defence: grass 1/0, forest 2/+2, mountain 3/+3, house 1/+1 (+5 HP each phase), water impassable except swimmers.
- Damage = max(1, atk − (def + terrain)); magic halves defence; rogue 30% crits ×2; defender counters if in range.
- Units pass allies but not enemies; each unit moves then attacks/heals/waits once per turn.

## Blocks Used
- custom `tactics.Board` (Dijkstra reach, ranges, combat, heal, phase heal, AI plan, distance field)

## Controllers
- Mouse: click unit → blue tile → menu (攻擊/治療/待命) → target; Esc cancels/undoes the move; E or button ends the turn.

## Acceptance Tests
- Maps valid, spawns walkable, armies connected; reach/water/damage/magic/crit/counter/heal/house/AI-kill/victory rules (verify.ts).
