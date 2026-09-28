import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.TEST_URL ?? 'http://127.0.0.1:8790';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
await mkdir('reports/screenshots', { recursive: true });
const results = [];
const ids = process.argv.slice(2).map(Number);
try {
  for (const id of ids.length ? ids : Array.from({ length: 12 }, (_, i) => i + 1)) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [], failedRequests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const result = { id, errors, failedRequests };
    try {
      await page.goto(`${base}/Game${id}/complete/?webgl`);
      await page.waitForFunction(() => window.game?.scene && document.querySelector('#moe-touch'), { timeout: 20000 });
      await page.waitForTimeout(1200);
      result.portrait = await page.evaluate(() => ({ fits: document.documentElement.scrollWidth <= innerWidth,
        buttons: [...document.querySelectorAll('#moe-touch button')].every(b => b.getBoundingClientRect().height >= 44), renderer: game.renderer }));
      assert.ok(result.portrait.fits && result.portrait.buttons);
      await page.screenshot({ path: `reports/screenshots/Game${id}-mobile-portrait.png` });
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(200);
      const tap = async code => { await page.locator(`#moe-touch button[data-code="${code}"]`).first().tap(); await page.waitForTimeout(900); };
      await tap('Enter');
      if (id === 2) {
        for (const code of ['Enter', 'KeyD', 'Enter', 'KeyD', 'Enter', 'Enter']) await tap(code);
      } else if (id === 6) {
        for (let i = 0; i < 4; i++) {
          const position = await page.evaluate(i => { const r = game.scene.cards[i], c = game.canvas.getBoundingClientRect(), v = game.view; return { x: c.left + (r.x + r.w / 2 - v.x) / v.w * c.width, y: c.top + (r.y + r.h / 2 - v.y) / v.h * c.height }; }, i);
          await page.touchscreen.tap(position.x, position.y); await page.waitForTimeout(180);
        }
        assert.equal(await page.evaluate(() => game.scene.picks.length), 4);
        await tap('Enter');
      } else if (id !== 8) {
        await tap('Enter');
        if ([3, 4].includes(id)) await tap('Enter');
        if (id === 5) { await tap('Enter'); await tap('Enter'); }
      }
      result.play = await page.evaluate(() => {
        const s = game.scene;
        return { fields: Object.keys(s).filter(k => !['game','camera','input','physics','physics2d','sprites','collisionMap','backgroundMaps','pool','vfx','events','delayedCallsPaused','solids','delayed','ons','_listeners','frameSizer','viewRect'].includes(k)), width: game.canvas.clientWidth, height: game.canvas.clientHeight };
      });
      // Game state field names are from each game's authored scene, not engine internals.
      const expected = {1:['gs'],2:['ps'],3:['karts'],4:['hero'],5:['fight'],6:['b'],7:['ps'],8:['b','battle'],9:['b','board','ps'],10:['tanks'],11:['pilot'],12:['ps','actors']}[id];
      assert.ok(expected.some(k => result.play.fields.includes(k)), `Game${id} did not enter gameplay: ${result.play.fields}`);
      const input = await context.newCDPSession(page);
      const right = await page.locator('#moe-touch button[data-code="KeyD"]').boundingBox();
      const action = await page.locator('#moe-touch .actions button').first().boundingBox();
      await input.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:right.x+right.width/2,y:right.y+right.height/2,id:1},{x:action.x+action.width/2,y:action.y+action.height/2,id:2}] });
      await page.waitForTimeout(150);
      result.multiTouch = await page.evaluate(() => {const code=document.querySelector('#moe-touch .actions button').dataset.code; return game.input.key('KeyD') && game.input.key(code);});
      assert.ok(result.multiTouch, 'movement and action must work simultaneously');
      await input.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
      await page.waitForTimeout(80);
      result.released = await page.evaluate(() => !game.input.key('KeyD'));
      assert.ok(result.released);
      await page.getByRole('button', { name:'暫停', exact:true }).tap();
      result.pause = await page.evaluate(() => game.paused); assert.ok(result.pause);
      await page.getByRole('button', { name:'繼續', exact:true }).tap();
      await page.getByRole('button', { name:'靜音', exact:true }).tap();
      result.mute = await page.evaluate(() => game.sound.muted); assert.ok(result.mute);
      await page.waitForTimeout(1100);
      await page.screenshot({ path:`reports/screenshots/Game${id}-mobile-play.png` });
      assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
      result.ok = true;
    } catch (error) { result.ok = false; result.failure = error.message; }
    results.push(result); console.log(`Game${id}: ${result.ok ? 'PASS' : 'FAIL ' + result.failure}`);
    await context.close();
  }
} finally { await browser.close(); }
await writeFile('reports/mobile-verification.json', JSON.stringify(results, null, 2) + '\n');
if (results.some(r => !r.ok)) process.exitCode = 1;
