import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const mobile = await readFile('shared/mobile-cloud.ts', 'utf8');
for (let id = 1; id <= 12; id++) {
  const dir = `Game${id}/cloud/src`;
  await writeFile(`${dir}/mobile.ts`, mobile);
  let boot = await readFile(`${dir}/game.ts`, 'utf8');
  if (!boot.includes('installMobileControls')) boot = "import { installMobileControls } from './mobile.js';\n" + boot.replace('game.run();', `installMobileControls(game, ${id});\ngame.run();`);
  await writeFile(`${dir}/game.ts`, boot);
  async function patchPointers(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) { await patchPointers(file); continue; }
      if (!entry.name.endsWith('.ts') || entry.name === 'mobile.ts') continue;
      let code = await readFile(file, 'utf8');
      if (!code.includes('this.input.pointer') || code.includes('mobilePointer')) continue;
      const relative = path.relative(path.dirname(file), path.join(dir, 'mobile.js')).replaceAll('\\', '/');
      code = `import { mobilePointer } from '${relative.startsWith('.') ? relative : './' + relative}';\n` + code.replaceAll('this.input.pointer', 'mobilePointer(this.input.pointer)');
      await writeFile(file, code);
    }
  }
  await patchPointers(dir);
}
const file = 'Game7/cloud/src/scenes/arena.ts';
let code = await readFile(file, 'utf8');
if (!code.includes('mobileAim')) {
  code = "import { mobileAim } from '../mobile.js';\n" + code;
  code = code.replace('if (ptr) {\n      // Pointer', 'if (mobileAim.active) p.aim = Math.atan2(mobileAim.y, mobileAim.x);\n    else if (ptr) {\n      // Pointer');
  await writeFile(file, code);
}
console.log('Mobile controls wired into all 12 cloud source projects.');
