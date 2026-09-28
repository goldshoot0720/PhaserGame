// Read the game's own exported asset data; no engine extraction or recreation.
import { stripTypeScriptTypes } from 'node:module';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { games } from './catalog.mjs';
const root = process.cwd();
async function compile(src, out) {
  await mkdir(out, { recursive: true });
  for (const e of await readdir(src, { withFileTypes: true })) {
    if (e.isDirectory()) await compile(path.join(src, e.name), path.join(out, e.name));
    else if (e.name.endsWith('.ts')) {
      const code = stripTypeScriptTypes(await readFile(path.join(src, e.name), 'utf8'), { mode: 'transform' });
      await writeFile(path.join(out, e.name.replace(/\.ts$/, '.js')), code);
    }
  }
}
const manifest = [];
for (const game of games) {
  const dir = path.join(root, '.cache', `Game${game.id}`);
  await compile(`Game${game.id}/cloud/src`, dir);
  const urls = new Set();
  const exports = {};
  function visit(value) {
    if (typeof value === 'string' && /^https:\/\/gameblocks\..+\.(png|jpg|webp|mp3|ogg|wav)$/.test(value)) urls.add(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  }
  for (const file of ['data', 'rules', 'art', 'roster', 'cards', 'menu']) {
    try {
      const mod = await import(pathToFileURL(path.join(dir, `${file}.js`)));
      visit(mod);
      Object.assign(exports, mod);
    } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
  }
  const logo = exports.ART?.logo || exports.LOGO;
  const assets = [...urls].map(url => ({ url, file: 'shared/media/' + new URL(url).pathname.slice(1) }));
  manifest.push({ ...game, logo: logo?.replace('https://gameblocks.nyc3.digitaloceanspaces.com/', 'shared/media/'), assets });
}
await mkdir('shared', { recursive: true });
await writeFile('shared/catalog.json', JSON.stringify(manifest, null, 2) + '\n');
const unique = new Map(manifest.flatMap(g => g.assets).map(a => [a.url, a]));
const curl = [...unique.values()].flatMap(a => [`url = "${a.url}"`, `output = "${a.file}"`]).join('\n');
await writeFile('.cache/assets.curl', curl + '\n');
await writeFile('.cache/pages.curl', games.flatMap(g => [`url = "https://phaser.games/play/${g.project}"`, `output = ".cache/Game${g.id}-play.html"`]).join('\n') + '\n');
console.log(`${games.length} games, ${unique.size} unique art/music files`);
