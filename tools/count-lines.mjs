import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ignored = new Set(['node_modules', 'dist', '.cache', '.git', '.claude', '.openai', 'complete', 'release', 'site']);
async function count(dir) {
  let lines = 0, files = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { const n = await count(file); lines += n.lines; files += n.files; }
    else if (/\.(ts|js|mjs|cjs|css|html|java|py)$/.test(entry.name)) { lines += (await readFile(file, 'utf8')).trimEnd().split('\n').length; files++; }
  }
  return { lines, files };
}
const groups = [...Array.from({length:12}, (_,i)=>`Game${i+1}`), 'shared', 'tools', 'packaging', 'guides'];
const rows=[];
for (const group of groups) { const c=await count(group); rows.push(`| ${group} | ${c.files} | ${c.lines.toLocaleString('en-US')} |`); }
await mkdir('reports',{recursive:true});
await writeFile('reports/code-lines.md', '# 程式碼統計\n\n統計遊戲原始碼、共用介面、建置工具、原生外殼與指南頁面；排除完整遊戲 bundle、第三方依賴、暫存與發行包。各遊戲可能包含保留的早期獨立版本，不等同唯一程式行數。\n\n| 目錄 | 檔案 | 行數 |\n| --- | ---: | ---: |\n'+rows.join('\n')+'\n');
console.log('Updated reports/code-lines.md');
