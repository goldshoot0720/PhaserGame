---
manifest:
category: game
title: 萌友棒球對決 Moe Baseball Showdown
summary: A 3-inning catcher's-view baseball game — time your swings with a meet cursor, then pick, aim and throw pitches against a CPU team.
render: webgpu
---

# 萌友棒球對決
Role: A single-player Power-Pro-style baseball match between two 4-player chibi teams; the user bats and pitches.

## Invariants
- 3 strikes = out, 4 balls = walk, foul never makes the 3rd strike, 3 outs switch sides.
- User's team bats last (home); walk-off ends the game; up to 3 extra innings then a tie.
- Batting: a meet circle (size from contact) + swing timing window ±0.11 s decide contact.
- Pitching: each pitcher owns 2–4 pitch types with distinct break and speed.

## Blocks Used
Components:
- custom `rules.GameState` — count/outs/bases/score/innings
- custom `sim` — pitch flight + break, swing resolution, CPU batter & pitcher
- custom `ui` — cached unicode text, buttons, panels
Systems:
- engine scenes, fx particles, camera shake, synth SFX, music

## Tuning
| Field | Value | Notes |
|---|---|---|
| INNINGS | 3 | regulation innings |
| ZONE_W × ZONE_H | 120 × 140 | strike zone, world units |
| timing window | ±0.11 s | swing contact window |
| meet radius | 0.35 + meet/220 zone units | cursor size |
| PITCH_TIME_BASE | 0.62 s @150 km/h | flight time scales with speed |
| CURSOR_SPEED | 520 u/s | keyboard cursor |
| control error | (1-control/100)×0.55 | pitch scatter |

## Controllers
- Batting: mouse or arrows/WASD move the meet circle; click or Space swings.
- Pitching: 1–4 or buttons choose the pitch; mouse/arrows aim; click in the field or Space throws.

## Wiring
- on pitch arrival → `GameState.apply(outcome)`; hits → crack SFX, spark burst, cheer; HR → camera shake.
- on `GameState.over` → GameOver scene with line score.

## Acceptance Tests
- Title → team select → play → result → replay/title flow exists.
- Strikeout, walk, forced run, sac fly, extra bases and half-inning switches follow the rules (verify.ts).
- A walk-off homer ends the game with the home team winning.
- Perfect contact by a slugger yields a home run; a far or mistimed swing whiffs.
