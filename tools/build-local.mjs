import { stripTypeScriptTypes } from 'node:module';
import { mkdir, readdir, readFile, writeFile, cp, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { localGames } from './local-games.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function compile(src, dest) {
  await mkdir(dest, { recursive: true });
  for (const e of await readdir(src, { withFileTypes: true })) {
    const from = path.join(src, e.name), to = path.join(dest, e.name);
    if (e.isDirectory()) await compile(from, to);
    else if (e.name.endsWith('.ts')) {
      let source = await readFile(from, 'utf8');
      // The optional Canvas backend supplies its own mobile controls.
      if (e.name === 'game.ts') source = source.replace(/import \{ installMobileControls \} from '\.\/mobile\.js';\n/, '').replace(/installMobileControls\(game, \d+\);\n/, '');
      const code = stripTypeScriptTypes(source, { mode: 'transform', sourceUrl: from });
      await writeFile(to.replace(/\.ts$/, '.js'), code);
    } else if (e.name.endsWith('.json')) await cp(from, to);
  }
}
export async function build() {
  const catalog = JSON.parse(await readFile(path.join(root, 'shared/catalog.json'), 'utf8'));
  const needed = new Set(catalog.filter(g => localGames.some(l => l.id === g.id)).flatMap(g => g.assets.map(a => a.file)));
  for (const file of needed) {
    if ((await stat(path.join(root, file))).size < 100) throw new Error(`素材損壞：${file}`);
    await mkdir(path.dirname(path.join(root, 'dist', file)), { recursive: true });
    await cp(path.join(root, file), path.join(root, 'dist', file));
  }
  for (const file of ['local-runtime.js', 'local-player.css', 'local-player.js', 'touch-controls.js']) await cp(path.join(root, 'shared', file), path.join(root, 'dist/shared', file));
  for (const g of localGames) {
    const output = path.join(root, `dist/Game${g.id}`);
    await compile(path.join(root, `Game${g.id}/cloud/src`), path.join(output, 'src'));
    await mkdir(path.join(output, 'engine'), { recursive: true });
    await writeFile(path.join(output, 'engine/webgpu.js'), "export { Game, Scene } from '../../shared/local-runtime.js';\n");
    await cp(path.join(root, `Game${g.id}/index.html`), path.join(output, 'index.html'));
  }
  await cp(path.join(root, 'local.html'), path.join(root, 'dist/index.html'));
  await cp(path.join(root, 'local.html'), path.join(root, 'dist/local.html'));
  console.log(`Built ${localGames.length} local games using their existing source, ${needed.size} local art/music files.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
