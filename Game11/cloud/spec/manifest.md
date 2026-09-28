---
manifest:
category: game
title: 萌友戰機 2026～2027 Moe Strikers
summary: Vertical arcade shooter — pick one of eight pilots (eight shot types), auto-fire through two stages (2026 ocean, 2027 space), power up to Lv.4, bomb out of danger, beat a midboss and a three-phase boss each year.
render: webgpu
---

# 萌友戰機 2026～2027
Role: Single-player shmup.

## Invariants
- Tiny 4-px hitbox, Shift for precise slow movement; auto-fire; X/Space bomb clears bullets, hurts everything, grants invulnerability.
- Shot types: spread, piercing laser, homing missiles, vulcan, side options, orbiting pages (block bullets), short flame, front+rear.
- Timeline: waves → midboss at 38 s → more waves → WARNING → boss at 80 s; boss phases change at 66% / 33% HP.
- Death: lose a life and one power level (dropped as a P item); bombs refill to 3. Extends at 60k / 180k.

## Blocks Used
- custom: shot generators, paths, wave timeline, bullet patterns (src/rules.ts); play loop (src/scenes/play.ts); engine fx particles, shake, synth SFX, music.

## Tuning
| Field | Value |
|---|---|
| Speed / focus | 330 / 165 |
| Fire rate | 0.09 s (missiles 0.5 s) |
| Lives / bombs | 3 / 3 (max 6) |
| Stage 2 | bullets ×1.18, fire ×1.25 |
| Boss HP | 1500 / 1900 (+25% in stage 2 for all enemies) |

## Controllers
- Arrows/WASD move, Shift slow, X/Space bomb, mouse/touch drag, Esc quit.

## Acceptance Tests
- See src/verify.ts: pilot variety and scaling, DPS balance, clamps, special shots, wave schedules, paths, pattern maths, boss phases, extends.
