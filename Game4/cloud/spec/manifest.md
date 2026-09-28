---
manifest:
category: game
title: 萌友洛克英雄 Moe Rock Heroes
summary: A Mega-Man-style action platformer — pick one of eight chibi heroes, clear seven boss stages in any order, steal each boss's weapon and exploit the weakness loop, then storm the final fortress boss rush.
render: webgpu
---

# 萌友洛克英雄
Role: Single-player run-and-gun platformer with stage select and weapon-weakness loop.

## Invariants
- The seven characters you did not pick are the bosses; each boss is weak to exactly one weapon (the boss weak to your own weapon falls to a full charge shot).
- Beating a boss grants its weapon (ammo-limited); progress saves per hero.
- Stages are built from tile chunks; each ends with a corridor, shutter door and a one-screen boss room.
- Final fortress unlocks after all seven: a boss rush of all seven at half health.
- In the fortress, each defeated boss restores 17 HP (about 60% of the 28 HP bar, capped at full); every third boss defeated grants one extra life. Completed bosses stay completed after respawn.
- E 罐 fully restores the 28 HP bar when used with R (only if hurt), capped at 9. M 罐 restores both the HP bar and every special weapon's ammo when used with M (only if something is depleted), capped at 9. Enemies may rarely drop either tank. P pauses all gameplay and stage timers, then resumes with P.
- After all seven, transition automatically into the separate 要塞核心 stage carrying HP, lives, ammo, E 罐 and M 罐. Entering this final stage grants three of each tank once. Reaching the citadel saves a checkpoint per hero: after a life loss or game over the fortress slot starts inside the guardian room, skipping the seven-boss rush and citadel traversal; defeated guardian forms remain defeated. Resetting progress removes the checkpoint. The final guardian has three sequential forms with separate HP bars (28/32/36), distinct attacks, and different weak weapons: 泡泡水柱 / 冰晶飛鏢 / 火焰三連. Defeated forms stay defeated after a life loss; clearing form 3 unlocks the ending.

## Blocks Used
- custom `levels.buildLevel` (chunk grammar → tiles/entities), custom tile physics (solid, one-way, ladders, spikes, movers)
- custom weapons (buster + charge, bubble, ice, bounce, rapid, claw, book, fire3, whirl), enemies (walker, flyer, turret), boss AI (jump/shoot/dash, rush phase)

## Tuning
| Field | Value |
|---|---|
| run / jump / jumpCut | 165 / 510 / 160 |
| gravity | 1150 |
| slide | 320 px/s for 0.32 s |
| charge mid / full | 0.7 s / 1.4 s |
| HP / ammo / lives | 28 / 28 / 3 |
| E 罐 | full HP; max 9; +3 on 要塞核心 entry |
| M 罐 | full HP and all weapon ammo; max 9; +3 on 要塞核心 entry |
| fortress boss rewards | +17 HP per boss; +1 life after bosses 3 and 6 |
| final guardian forms | 28 / 32 / 36 HP; weaknesses whale / penguin / redcat |
| boss HP (rush) | 28 (14) |
| weakness / normal hit | 4 / 1 |

## Controllers
- ←→ move, Z jump, X shoot (hold to charge), ↓+Z slide, ↑↓ ladders, Q/E switch weapon, R use E 罐, M use M 罐, P pause/resume, Esc leave stage.

## Acceptance Tests
- Title → hero select → stage select → stage → boss → weapon get → stage select; fortress → ending.
- Weakness chart is a permutation; every stage builds with a start on solid ground, checkpoints and a walled boss room (verify.ts).
- Fortress reward healing exceeds half the HP bar and caps at max; third and sixth boss rewards add one life (verify.ts).
- E 罐 restore full health; M 罐 restore health and all special weapons. Both cannot be wasted when full or after death. Pause freezes scheduled stage events (verify.ts).
- Citadel builds as a separate level; three guardian weaknesses differ, each form has one HP bar; boss-rush completion transfers the earned lives into the citadel. Stage select resumes the saved guardian phase after game over (verify.ts).
