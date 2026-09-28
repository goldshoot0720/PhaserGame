import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const target = '.cache/release-site';
await mkdir(target, { recursive: true });
for (const file of ['index.html', 'play.html', 'shared', 'guides']) await cp(file, `${target}/${file}`, { recursive: true, filter: source => !source.endsWith('.ts') && !source.includes('local-') && !source.endsWith('touch-controls.js') });
for (let id = 1; id <= 12; id++) {
  for (const file of ['complete', 'GUIDE.md', 'STRATEGY.md', 'cloud/src']) await cp(`Game${id}/${file}`, `${target}/Game${id}/${file}`, { recursive: true });
}
await mkdir(`${target}/reports`, { recursive: true });
await cp('reports/code-lines.md',`${target}/reports/code-lines.md`).catch(()=>{});
const assets = JSON.parse(await readFile('shared/catalog.json','utf8')).flatMap(g=>g.assets);
for (const file of new Set(assets.map(a=>a.file))) {
  const bytes = await readFile(`${target}/${file}`); if (bytes.length < 100) throw new Error(`Invalid asset ${file}`);
}
await writeFile(`${target}/version.json`,JSON.stringify({version:'1.0.0', games:12, built:new Date().toISOString()}));
console.log(`Release site ready: ${target} (12 games, offline media)`);
