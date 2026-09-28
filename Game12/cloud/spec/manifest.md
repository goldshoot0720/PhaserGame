---
manifest:
category: game
title: 水球大作戰 Moe Balloon Battle
summary: Four-player Crazy Arcade-style water balloon battle — break crates, grab upgrades, trap rivals in bubbles and pop them; first to win two rounds takes the match.
render: webgpu
---

# 水球大作戰
Role: You vs three bots, best of three (tie-break rounds up to five).

## Invariants
- Balloons burst after 2.6 s into a cross of water; arms stop at pillars, soak the first crate, and chain into other balloons.
- Water traps a player in a bubble for 3.5 s: a rival touching it pops it (out); a needle (Shift/E) frees you; otherwise it bursts.
- Crates drop balloon+1, range+1, speed+1, needle, or max range; water destroys items lying on the floor.
- Round ends when one player is left (not trapped), everyone is out, or after 150 s (draw).

## Blocks Used
- custom: grid/blast/chain/danger-map/BFS/bot brain (src/rules.ts), grid movement with corner sliding and the round loop (src/scenes/play.ts).

## Tuning
| Field | Value |
|---|---|
| Grid | 15 × 13, crate density 72% |
| Fuse / water | 2.6 s / 0.55 s |
| Trap time | 3.5 s |
| Speed | 3.0 + 0.45 per skate level |
| Caps | 8 balloons, range 8, speed Lv 8 |

## Controllers
- Arrows/WASD move, Space drop, Shift/E needle, Esc quit. Bots: flee danger, pop trapped rivals, bomb crates/rivals only with a proven escape, collect items.

## Acceptance Tests
- See src/verify.ts: map, blasts, pillars, crates, chains, danger timing, pathing, bot flee/bomb/no-suicide/items/pop, items table, match rules.
