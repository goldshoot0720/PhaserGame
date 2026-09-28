---
manifest:
category: game
title: 萌友卡牌對決 Moe Card Duel
summary: A cozy Hearthstone-style 1v1 card duel — eight chibi minions with taunt, charge, battlecries and end-of-turn buffs, mana curve to 10, versus a trading-savvy CPU.
render: webgpu
---

# 萌友卡牌對決
Role: Single-player card battler (rules and AI ported from the local Game8).

## Invariants
- 30 HP heroes; 3 mana on the opening turn, then +1 per own turn to 10; 16-card decks (2 copies of 8); hand max 8 (overdraw burns), board max 5; empty deck = growing fatigue.
- Minions sleep the turn they are played unless they have 衝鋒; if the defender has any minions, the hero cannot be targeted. 嘲諷 minions must be attacked before other minions; combat damage is simultaneous.

## Controllers
- The 30 inside each hero portrait is life, while blue crystals and the hand label show current/max mana; a card's blue corner number is its mana cost. If short, the feedback shows required/current mana.
- Click a glowing card to play it; click a green-bordered minion then a red-bordered target to attack; End Turn button / Space.

## Acceptance Tests
- Opening hands guarantee a card costing at most 3 for each player; 500 randomized starts verify playable openers and deck copy counts. Enemy minions block direct hero attacks; taunt retains priority. Mana, keywords, battlecries, taunt, counter damage, fatigue; 40 AI-vs-AI games all finish (verify.ts).
