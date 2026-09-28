---
manifest:
category: game
title: 萌友卡丁車 GP Moe Kart GP
summary: A cute pseudo-3D kart racer — pick one of eight chibi drivers and race seven CPU karts for three laps with drift mini-turbos and items on three tracks.
render: webgpu
---

# 萌友卡丁車 GP
Role: Single-player 8-kart, 3-lap arcade kart race.

## Invariants
- Chase-camera segment road (engine `createRoad`), curves push karts outward (centrifugal), off-road caps speed.
- Drift (hold Shift while steering above half speed) charges blue (0.8 s) / orange (1.6 s) mini-turbos.
- Items from rainbow boxes: 衝刺魚 (boost), 香蕉皮 (drop hazard), 泡泡彈 (homing shot), 無敵星 (invincible); worse places roll better items.
- 3 laps; standings by finish time then distance.

## Blocks Used
- engine pack `route.createRoad` (PseudoRoad: view/place/curveAt/distanceAtScreenY)
- custom race sim (player physics, AI racing line + rubber band + items, kart collisions)

## Tuning
| Field | Value | Notes |
|---|---|---|
| MAX_SPEED | 7200 u/s × racer speed | |
| ACCEL / BRAKE / COAST | 3000 / 7000 / 1400 | |
| OFFROAD_MAX | 0.45 | |
| STEER | 1.9 half-widths/s | × track grip × handling |
| CENTRIFUGAL | 0.2 | × curve × speed² |
| BOOST_MUL | 1.35 | |
| LAPS | 3 | |

## Controllers
- ↑ gas, ↓ brake, ←→ steer, Shift drift, Space item, Esc quit.

## Wiring
- box contact → rollItem(place) ; banana contact / bubble hit → spin-out ; star contact → knock others.
- lap crossing → banner; final lap → finish → results with podium + best time (localStorage).

## Acceptance Tests
- Title → racer select → track select → race → results flow.
- Track lengths give 15–45 s laps, hills net zero (loop closes), items favour back markers, standings order correct.
