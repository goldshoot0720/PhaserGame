import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try {
 for (const mobile of [false,true]) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1366,height:900},hasTouch:mobile,isMobile:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8790');
  await page.locator('.game-card').last().waitFor();
  assert.equal(await page.locator('.game-card').count(),12);
  await page.locator('#search').fill('戰棋');assert.equal(await page.locator('.game-card').count(),1);
  await page.locator('.play-link').click();
  await page.waitForFunction(()=>document.querySelector('#pause').disabled===false);
  const frame=page.frameLocator('#game-frame');
  await page.locator('#pause').click();
  await page.waitForFunction(()=>document.querySelector('#game-frame').contentWindow.game.paused === true);
  await page.locator('#pause').click();
  await page.waitForFunction(()=>document.querySelector('#game-frame').contentWindow.game.paused === false);
  await page.locator('#help').click();await page.locator('#help-dialog[open]').waitFor();
  await page.waitForFunction(()=>document.querySelector('#game-frame').contentWindow.game.paused === true);
  await page.locator('#close-help').click();
  await page.waitForTimeout(100);
  await page.waitForFunction(()=>document.querySelector('#game-frame').contentWindow.game.paused === false);
  await page.locator('#restart').click();await page.locator('#confirm-restart').click();
  await page.waitForFunction(()=>document.querySelector('#pause').disabled===false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(mobile){ await page.setViewportSize({width:844,height:390});await page.waitForTimeout(600); }
  await page.screenshot({path:`reports/screenshots/shell-${mobile?'mobile':'desktop'}.png`});
  assert.deepEqual(errors,[]);results.push({mobile,ok:true,search:true,pause:true,guidePauseResume:true,restart:true,errors});
  await context.close();
 }
} finally {await browser.close();}
await writeFile('reports/shell-verification.json',JSON.stringify(results,null,2)+'\n');
console.log('SHELL_OK: desktop/mobile catalog search, launch, pause, guide and restart');
