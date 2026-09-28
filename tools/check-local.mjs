import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { build } from './build-local.mjs';
import { localGames } from './local-games.mjs';
await build();
const catalog = JSON.parse(await readFile(new URL('../shared/catalog.json', import.meta.url), 'utf8'));
const assets = new Map(catalog.flatMap(g => g.assets).map(a => [a.file, a]));
for (const a of assets.values()) {
  const file = new URL('../' + a.file, import.meta.url);
  if ((await stat(file)).size < 100) throw new Error(`Empty asset: ${a.file}`);
  if (a.file.endsWith('.png')) {
    const bytes = await readFile(file);
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Invalid PNG: ${a.file}`);
  }
}
console.log(`ASSETS_OK: ${assets.size} files across ${catalog.length} games`);
for (const g of localGames) {
  const result = spawnSync(process.execPath, [new URL(`../dist/Game${g.id}/src/verify.js`, import.meta.url).pathname], { encoding: 'utf8' });
  if (result.status !== 0) { console.error(result.stdout, result.stderr); process.exit(1); }
  console.log(`Game${g.id}: ${result.stdout.trim().split('\n').at(-1)}`);
}
const tests = spawnSync(process.execPath, ['--test', new URL('./runtime.test.mjs', import.meta.url).pathname], { stdio: 'inherit' });
if (tests.status !== 0) process.exit(1);
