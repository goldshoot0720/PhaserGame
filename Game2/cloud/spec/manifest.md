---
manifest:
category: game
title: 萌友街頭 3x3 Moe Street 3x3
summary: Pick three chibi ballers and play FIBA-style 3x3 half-court basketball against a CPU trio — dribble, pass, time your jumper, steal and block.
render: webgpu
---

# 萌友街頭 3x3
Role: A single-player 3-on-3 street basketball game on one half court.

## Invariants
- 1 point inside the arc, 2 beyond; first to 21 or best score when the 4:00 clock ends; tie → sudden-death.
- 12-second shot clock; after a defensive rebound or steal the ball must be cleared beyond the arc.
- After a made basket the other team checks the ball at the top of the key.

## Blocks Used
- custom `rules.Match` (score/clocks/possession/clear rule), `rules.shotChance`, `rules.meterQuality`
- custom `court` (perspective trapezoid floor, 3-pt ellipse, depth scale)
- custom Play scene AI (ball handler drive/shoot/pass, off-ball rotation, man defense, steals, blocks, rebounds)

## Tuning
| Field | Value | Notes |
|---|---|---|
| WIN_SCORE | 21 | 3x3 target |
| GAME_TIME | 240 s | arcade length |
| SHOT_CLOCK | 12 s | |
| RUN_SPEED | 190 px/s @ speed 5 | depth axis ×0.62 |
| PASS_SPEED | 620 px/s | |
| STEAL_RANGE / BLOCK_RANGE | 34 / 44 px | |
| METER_TIME | 0.9 s | sweet window 0.78–0.92 |

## Controllers
- Offense: arrows move, Shift sprint, hold/release Space to shoot with the meter, K passes (direction picks the target).
- Defense: Space jump/block, K steal, Q switch player.

## Wiring
- made shot → Match.made → swish + sparks → check ball; miss → loose ball → rebound → Match.gain / offensiveRebound.
- shot clock expiry → whistle → turnover check.

## Acceptance Tests
- Title → pick 3 → play → result flow.
- Scoring values, clear rule, shot clock, 21-point win and OT sudden death behave per verify.ts.
- Shot odds fall with distance and contest and rise with meter timing.
