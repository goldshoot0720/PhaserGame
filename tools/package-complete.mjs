import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { games } from './catalog.mjs';
const sha = s => createHash('sha256').update(s).digest('hex');
const versions = JSON.parse(await readFile('.cache/versions.json', 'utf8'));
const output = [];
for (const game of games) {
  const raw = await readFile(`.cache/Game${game.id}-bundle.js`, 'utf8');
  if (!raw.startsWith('/*\n * Phaser AE') || !raw.includes('Copyright © 2026 Phaser Studio')) throw Error(`Invalid game package ${game.id}`);
  // Keep the complete compiled game and license. Only its game asset origin changes.
  const code = raw.replaceAll('https://gameblocks.nyc3.digitaloceanspaces.com/', '../../shared/media/');
  const dir = `Game${game.id}/complete`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/bundle.js`, code);
  await writeFile(`${dir}/index.html`, `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${game.title}</title><style>html,body,#game{margin:0;width:100%;height:100%;overflow:hidden;background:#10162a}body{font-family:system-ui;color:white}#loading{position:fixed;inset:0;display:grid;place-content:center;text-align:center;background:#10162a;z-index:10}button{padding:12px;font:inherit;cursor:pointer}</style></head><body><div id="game"></div><div id="loading" role="status">正在準備${game.title}…</div><script type="module" src="../../shared/runtime.js"></script></body></html>`);
  output.push({ id: game.id, source: versions.find(v => v.id === game.id).bundleUrl, originalSha256: sha(raw), localSha256: sha(code), bytes: Buffer.byteLength(code), change: 'Game asset origin only; complete game and engine license retained.' });
}
await writeFile('shared/packages.json', JSON.stringify(output, null, 2) + '\n');
console.log('Packaged 12 complete games.');
