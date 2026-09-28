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
const { createHash } = await import('node:crypto');
const packages = JSON.parse(await readFile('shared/packages.json','utf8'));
if (catalog.length !== 12 || packages.length !== 12) throw Error('Expected 12 games');
for (const game of catalog) {
  const bundle = await readFile(`Game${game.id}/complete/bundle.js`);
  const entry = packages.find(p=>p.id===game.id);
  if (createHash('sha256').update(bundle).digest('hex') !== entry.localSha256) throw Error(`Game${game.id} package hash mismatch`);
  if (!bundle.toString('utf8',0,300).includes('Phaser AE')) throw Error('Engine license must remain intact');
  for (const file of [`Game${game.id}/complete/index.html`, `guides/Game${game.id}.html`, `Game${game.id}/GUIDE.md`, `Game${game.id}/STRATEGY.md`]) if ((await stat(file)).size < 100) throw Error(`Incomplete ${file}`);
  const cloud = await readFile(`Game${game.id}/cloud/src/mobile.ts`,'utf8');
  if (cloud !== await readFile('shared/mobile-cloud.ts','utf8')) throw Error(`Game${game.id} mobile module drift`);
}
console.log('COLLECTION_OK: 12 licensed packages, matching hashes, guides and mobile controls');
