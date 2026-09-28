export const WIDTH = 1100;
export const HEIGHT = 760;
export const GRAVITY = 480;
export const WEAPONS = [
  { name: '標準彈', damage: 30, radius: 48, color: 0xffd36b },
  { name: '重砲', damage: 43, radius: 35, color: 0xff857b },
  { name: '廣域彈', damage: 24, radius: 75, color: 0x76e5e9 },
];

export function makeTerrain() {
  return Array.from({ length: WIDTH + 1 }, (_, x) =>
    Math.round(543 + 38 * Math.sin(x / 112) + 21 * Math.sin(x / 49) + 8 * Math.sin(x / 19)));
}

export function surface(terrain, x) {
  return terrain[Math.max(0, Math.min(WIDTH, Math.round(x)))];
}

export function traceShot({ x, angle, power, side, wind, terrain, targetX }) {
  const radians = angle * Math.PI / 180;
  const speed = 300 + power * 4;
  let px = x + side * 28, py = surface(terrain, x) - 30;
  let vx = side * Math.cos(radians) * speed, vy = -Math.sin(radians) * speed;
  const points = [{ x: px, y: py }];
  for (let t = 0; t < 4.5; t += .02) {
    vx += wind * 7 * .02;
    vy += GRAVITY * .02;
    px += vx * .02;
    py += vy * .02;
    points.push({ x: px, y: py });
    if (targetX != null && Math.hypot(px - targetX, py - (surface(terrain, targetX) - 16)) < 19)
      return { points, x: px, y: py, direct: true };
    if (px < 0 || px > WIDTH || py > HEIGHT) return { points, x: px, y: py, direct: false };
    if (py >= surface(terrain, px)) return { points, x: px, y: py, direct: false };
  }
  return { points, x: px, y: py, direct: false };
}

export function damageAt(explosion, tankX, tankY, weapon) {
  const distance = Math.hypot(explosion.x - tankX, explosion.y - tankY);
  return distance >= weapon.radius ? 0 : Math.max(5, Math.round(weapon.damage * (1 - distance / weapon.radius * .55)));
}

export function carveCrater(terrain, x, radius) {
  for (let px = Math.max(0, Math.floor(x - radius)); px <= Math.min(WIDTH, Math.ceil(x + radius)); px++) {
    const offset = (px - x) / radius;
    terrain[px] = Math.min(HEIGHT - 25, terrain[px] + Math.round(Math.sqrt(Math.max(0, 1 - offset * offset)) * radius * .46));
  }
}

export function chooseAiShot(terrain, fromX, targetX, wind) {
  const options = [];
  for (let angle = 25; angle <= 75; angle += 3) {
    for (let power = 40; power <= 100; power += 2) {
      const result = traceShot({ x: fromX, angle, power, side: -1, wind, terrain, targetX });
      const score = Math.hypot(result.x - targetX, result.y - (surface(terrain, targetX) - 16));
      options.push({ angle, power, score });
    }
  }
  options.sort((a, b) => a.score - b.score);
  return options[Math.floor(Math.random() * Math.min(8, options.length))];
}
