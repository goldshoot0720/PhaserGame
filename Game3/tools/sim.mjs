// 無畫面模擬：8 台電腦車在每條賽道跑完 3 圈，檢查是否卡住並輸出圈速。
// 用法：node tools/sim.mjs
import { TRACKS } from '../src/data/tracks.js';
import { CHARACTERS } from '../src/data/characters.js';
import { TrackGeometry } from '../src/systems/TrackGeometry.js';
import { Kart } from '../src/objects/Kart.js';
import { AIDriver } from '../src/objects/AIDriver.js';
import { TOTAL_LAPS } from '../src/config.js';

globalThis.performance = globalThis.performance || { now: () => Date.now() };

let allOk = true;
for (const td of TRACKS) {
  const g = new TrackGeometry(td);
  const events = { wall: 0, nitro: 0, instant: 0 };
  const karts = CHARACTERS.map((c, i) => {
    const k = new Kart(null, c, g, { events: (type) => { if (type in events) events[type]++; } });
    const row = Math.floor(i / 2);
    const p = g.pointAt(-70 - row * 80, i % 2 === 0 ? -52 : 52);
    k.placeAt(p.x, p.y, p.heading);
    return k;
  });
  const ais = karts.map((k, i) => new AIDriver(k, 0.8 + (i % 4) * 0.05));
  const dt = 1 / 60;
  let time = 0;
  let offroadTime = 0;
  while (time < 400 && !karts.every((k) => k.finished)) {
    const sorted = [...karts].sort((a, b) => b.progress - a.progress);
    sorted.forEach((k, i) => (k.rank = i + 1));
    for (const ai of ais) ai.update(dt, { racers: karts, player: null, items: null, active: true });
    for (const k of karts) {
      k.update(dt, true, time * 1000);
      if (k.offroad) offroadTime += dt;
    }
    time += dt;
  }
  const fin = karts.filter((k) => k.finished).length;
  if (fin < 8) allOk = false;
  const laps = karts.map((k) => (k.bestLap ? (k.bestLap / 1000).toFixed(1) : '-'));
  const tot = karts.map((k) => (k.finishTime ? (k.finishTime / 1000).toFixed(1) : '-'));
  console.log(`${td.id}: finished ${fin}/8 in ${time.toFixed(1)}s; bestLaps [${laps.join(', ')}]; totals [${tot.join(', ')}]; walls=${events.wall} nitro=${events.nitro} instant=${events.instant} offroad%=${((offroadTime / (time * 8)) * 100).toFixed(1)}`);
}
console.log(`laps=${TOTAL_LAPS}`);
process.exit(allOk ? 0 : 1);
