---
manifest:
category: game
title: 萌友大亂鬥 Moe Arena Brawl
summary: An 8-player top-down free-for-all shooter — each chibi has a signature weapon; mouse-aim, dash, grab hearts and power bolts, first to 10 kills or most kills in 3 minutes wins.
render: webgpu
---

# 萌友大亂鬥
Role: Single-player arena deathmatch vs 7 bots.

## Invariants
- 100 HP, respawn after 3 s with a 2 s shield (shooting drops it); dash 0.16 s every 1.8 s.
- Eight weapons: bubble cannon, SMG, sniper (pierces), shotgun, returning boomerang (pierces), rapid pages, 3-way fire, splash grenade.
- Crates block movement, shots and line of sight; hearts +40 HP, bolts ×1.5 damage and faster fire for 8 s, both respawn every 12 s.

## Blocks Used
- custom arena sim (circle-box collision, projectile kinds, bot AI with target selection, strafing, leading shots, pickups), kill feed, minimap, scoreboard.

## Controllers
- WASD move, mouse aim, hold left button (or J) to shoot, Space/Shift dash, Tab scoreboard, Esc quit.

## Acceptance Tests
- Fighters/weapons valid; spawns and pickups clear of crates; collision push-out; line of sight; ranking order (verify.ts).
