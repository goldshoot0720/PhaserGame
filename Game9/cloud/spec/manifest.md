---
manifest:
category: game
title: 萌友大富翁 Moe Monopoly
summary: Four-player Monopoly/Richman board game — roll two dice, hop around a 28-space ring, buy deeds, build houses and a hotel, pay tolls, draw chance cards; richest after 20 rounds (or last solvent) wins.
render: webgpu
---

# 萌友大富翁
Role: One human vs three AI rivals, turn-based.

## Invariants
- 28 spaces: start, rest (jail visit), luck pot, go-to-jail corners; 4 chance, 2 tax; 18 deeds in 6 districts of 3.
- Passing start +$200. Toll = 10% of price × [1, 4, 9, 16] by level (empty lot doubled when the whole district is owned).
- Landing on your own deed offers an upgrade (cost 50% of price) up to a hotel (level 3).
- Short on cash: sell cheapest deeds at 60% value; still short → bankrupt, deeds released. Taxes and fines feed the luck pot.
- Each hero has one perk (start bonus, half tax, land discount, build discount, double windfalls, toll discount, toll bonus, extra cash).

## Blocks Used
- custom: board economy + AI (src/rules.ts), turn state machine with dice/hop animation (src/scenes/play.ts), shared UI helpers.

## Tuning
| Field | Value |
|---|---|
| Start cash | $1500 |
| Pass start | $200 |
| Rounds | 20 |
| Tax | $150 |
| Rent multipliers | 1 / 4 / 9 / 16 |
| AI buy reserve | $180 ($40 if it completes a district) |
| AI build reserve | $260 |

## Controllers
- Mouse buttons or Space (roll / accept / continue / end turn), N to decline, hover a space for details, Esc to quit.

## Acceptance Tests
- See src/verify.ts: layout, passing start, backwards move, buy/upgrade/toll maths, perks, liquidation, bankruptcy, ranking, AI reserve, card deck.
