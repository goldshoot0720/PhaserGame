import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Effects, Input, localAsset } from '../shared/local-runtime.js';

test('hit particles are bounded and expire after their lifetime', () => {
  const fx = new Effects(); fx.emit({ x: 0, y: 0, count: 2000, life: 0.3 });
  assert.equal(fx.particles.length, 1600);
  fx.update(0.1); assert.ok(fx.particles.some(p => p.x !== 0));
  fx.update(0.3); assert.equal(fx.particles.length, 0);
});

test('CDN art and music map to local files without altering other URLs', () => {
  assert.equal(localAsset('https://gameblocks.nyc3.digitaloceanspaces.com/x/art/a.png'), '/shared/media/x/art/a.png');
  assert.equal(localAsset('/image.png'), '/image.png');
});

test('input coordinates include canvas scale and camera offset; blur releases held keys', () => {
  const saved = { window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement };
  globalThis.window = new EventTarget(); globalThis.document = new EventTarget(); globalThis.HTMLElement = class {};
  const canvas = new EventTarget();
  Object.assign(canvas, { width: 1280, height: 720, getBoundingClientRect: () => ({ left: 100, top: 50, width: 640, height: 360 }) });
  const camera = { x: 700, y: 300 };
  const input = new Input(canvas, () => camera, () => {});
  try {
    input.locate({ clientX: 420, clientY: 230 });
    assert.deepEqual(input.pointer, { x: 1340, y: 660, isDown: false });
    camera.x = 800;
    assert.equal(input.pointer.x, 1440, 'stationary pointer follows camera movement');
    input.bind({ move: ['KeyD', 'ArrowRight'] });
    const key = new Event('keydown'); Object.defineProperty(key, 'code', { value: 'KeyD' });
    window.dispatchEvent(key); input.tick();
    assert.deepEqual(input.keys.move, { held: true, pressed: true, released: false });
    input.end(); input.tick(); assert.equal(input.keys.move.pressed, false);
    const release = new Event('keyup'); Object.defineProperty(release, 'code', { value: 'KeyD' });
    window.dispatchEvent(release); input.tick(); assert.equal(input.keys.move.released, true);
    input.end(); window.dispatchEvent(key); window.dispatchEvent(release); input.tick();
    assert.equal(input.keys.move.pressed, true, 'a quick tap between animation frames must not disappear');
    input.end(); input.tick(); assert.equal(input.keys.move.pressed, false);
    window.dispatchEvent(key); input.down = true;
    window.dispatchEvent(new Event('blur')); input.tick();
    assert.equal(input.keys.move.held, false); assert.equal(input.pointer.isDown, false);
    input.destroy(); window.dispatchEvent(key); assert.equal(input.codes.size, 0);
  } finally { input.destroy(); Object.assign(globalThis, saved); }
});
