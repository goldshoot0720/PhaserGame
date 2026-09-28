import './prepare-catalog.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { guides } from './guide-content.mjs';
import { games } from './catalog.mjs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const table = (head, rows) => [head, head.map(() => '---'), ...rows].map(r => '| ' + r.join(' | ') + ' |').join('\n');
const list = rows => rows.map(t => `- ${t}`).join('\n');
const numbered = rows => rows.map((t, i) => `${i + 1}. ${t}`).join('\n');
async function data(id, file) { return import(pathToFileURL(path.resolve(`.cache/Game${id}/${file}.js`))); }
async function detail(id) {
  switch (id) {
    case 1: { const d = await data(id, 'data'); return table(['球員', '打擊準確度', '力量', '跑速', '球速 km/h', '控球', '球種'], Object.values(d.PLAYERS).map(c => [c.name, c.meet, c.power, c.speed, c.velo, c.control, c.pitches.join('、')])); }
    case 2: { const d = await data(id, 'data'); return table(['球員', '投籃', '外線', '速度', '防守', '彈跳'], d.BALLERS.map(c => [c.name, c.shoot, c.three, c.speed, c.defense, c.jump])); }
    case 3: { const d = await data(id, 'data'); return table(['車手', '最高速度倍率', '加速度倍率', '操控倍率'], d.RACERS.map(c => [c.name, c.speed, c.accel, c.handling])); }
    case 4: { const d = await data(id, 'data'); return table(['頭目', '關卡', '取得武器', '弱點武器'], d.CHARACTERS.map(c => [c.name, c.stage, c.weapon.name, d.CHARACTERS.find(h => h.key === c.weakTo).weapon.name])); }
    case 5: { const d = await data(id, 'roster'); const motion = { qcf: '↓↘→', qcb: '↓↙←', dp: '→↓↘' }; return table(['角色', '生命', '必殺技', '指令（面向右）', '超必殺'], d.ROSTER.map(c => [c.name, c.health, c.special.name, motion[c.special.motion] + '＋' + c.special.button, c.super.name])); }
    case 6: { const d = await data(id, 'tactics'); return table(['角色', '職業', 'HP', '攻擊', '防禦', '移動', '射程', '特色'], d.CHARS.map(c => [c.name, c.role, c.hp, c.atk, c.def, c.mov, `${c.rmin}～${c.rmax}`, c.desc])); }
    case 7: { const d = await data(id, 'data'); return table(['角色', '武器', '每顆傷害', '發射間隔秒', '彈丸數', '射程'], d.FIGHTERS.map(c => [c.name, c.weapon.name, c.weapon.dmg, c.weapon.rate, c.weapon.pellets, c.weapon.range])); }
    case 8: { const d = await data(id, 'cards'); return table(['卡牌', '法力', '攻擊', '生命', '效果'], d.CARDS.map(c => [c.name, c.cost, c.atk, c.hp, c.text])); }
    case 9: { const d = await data(id, 'rules'); return table(['角色', '專屬優勢'], d.HEROES.map(c => [c.name, c.perkText])); }
    case 10: { const d = await data(id, 'rules'); return table(['角色', '特殊武器', '用途'], d.HEROES.map(c => [c.name, c.special.name, c.special.desc])); }
    case 11: { const d = await data(id, 'rules'); return table(['駕駛員', '主武器', '特性'], d.PILOTS.map(c => [c.name, c.shotName, c.desc])); }
    case 12: { const d = await data(id, 'rules'); return table(['角色', '初始水球數', '初始射程', '初始速度等級'], d.HEROES.map(c => [c.name, c.balloons, c.range, c.speed])); }
  }
}

// Small renderer for our generated subset of Markdown, escaping all content.
export function markdown(md, prefix = '') {
  const inline = s => escape(s).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${/^(https?:|#)/.test(href) ? href : prefix + href}">${label}</a>`).replace(/`([^`]+)`/g, '<code>$1</code>');
  const lines = md.split('\n'); let out = '', i = 0;
  while (i < lines.length) {
    const s = lines[i++];
    if (!s.trim()) continue;
    const h = s.match(/^(#{1,3}) (.+)/);
    if (h) { out += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; continue; }
    if (s.startsWith('| ')) {
      const rows = [s]; while (i < lines.length && lines[i].startsWith('| ')) rows.push(lines[i++]);
      out += '<div class="table-wrap"><table>' + rows.filter((_, j) => j !== 1).map((r, j) => '<tr>' + r.split('|').slice(1, -1).map(cell => `<${j === 0 ? 'th scope="col"' : 'td'}>${inline(cell.trim())}</${j === 0 ? 'th' : 'td'}>`).join('') + '</tr>').join('') + '</table></div>'; continue;
    }
    if (/^(- |\d+\. )/.test(s)) {
      const ordered = /^\d/.test(s), tag = ordered ? 'ol' : 'ul'; const rows = [s];
      while (i < lines.length && (ordered ? /^\d+\. / : /^- /).test(lines[i])) rows.push(lines[i++]);
      out += `<${tag}>` + rows.map(r => `<li>${inline(r.replace(/^(- |\d+\. )/, ''))}</li>`).join('') + `</${tag}>`; continue;
    }
    out += `<p>${inline(s)}</p>`;
  }
  return out;
}
await mkdir('guides', { recursive: true });
const catalog = JSON.parse(await readFile('shared/catalog.json', 'utf8'));
for (const game of games) {
  const g = guides[game.id], base = `Game${game.id}`;
  const guide = `# ${game.title}｜遊戲指南\n\n本指南對應完整版本（本機合集及 cloud 原始碼）；各資料夾原有 Vite 試作版可能採用不同規則。數值表由目前程式資料產生，攻略建議不代表保證獲勝。\n\n[遊戲攻略](STRATEGY.md) · [合集首頁](../index.html) · [線上遊玩](https://phaser.io/agent/local/${game.project})\n\n## 遊戲目標\n\n${g.goal}\n\n## 操作方式\n\n${table(['操作', '用途'], g.controls)}\n\n## 手機與平板\n\n觸控裝置會顯示方向鍵、確認與本作專用動作按鈕，可同時按住移動與動作。直接點選畫面上的選單、角色、卡牌或棋盤；大亂鬥可拖曳瞄準／射擊圓盤。橫向畫面較大，切換到背景會自動暫停，回來後按「繼續」。\n\n## 新手第一場\n\n${numbered(g.steps)}\n\n## 規則與畫面資訊\n\n${list(g.rules)}\n\n## 角色與能力速查\n\n${await detail(game.id)}\n\n## 常見問題\n\n${g.faq.map(([q, a]) => `### ${q}\n\n${a}`).join('\n\n')}\n\n## 規則來源\n\n${list(g.source.map(s => `[${s}](cloud/src/${s})`))}\n`;
  const strategy = `# ${game.title}｜遊戲攻略\n\n[遊戲指南](GUIDE.md) · [合集首頁](../index.html)\n\n## 核心思路\n\n${game.summary}\n\n## 由入門到進階\n\n${numbered(g.strategy)}\n\n## 一次可練會的流程\n\n${g.practice}\n\n## 失誤排查\n\n${g.faq.map(([q, a]) => `### ${q}\n\n${a}`).join('\n\n')}\n\n## 開局檢查\n\n- 先看本作指南的按鍵與勝利條件，確認目前所選角色的能力。\n- 完成一項基礎練習後，再加入下一種技巧。\n- 戰敗後先找一個可修正的操作或資源決策，下一場專注改善它。\n\n## 規則依據\n\n${list(g.source.map(s => `[${s}](cloud/src/${s})`))}\n`;
  await writeFile(`${base}/GUIDE.md`, guide); await writeFile(`${base}/STRATEGY.md`, strategy);
  const logo = catalog.find(c => c.id === game.id).logo;
  await writeFile(`guides/Game${game.id}.html`, `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${escape(game.title)}｜指南與攻略</title><link rel="stylesheet" href="../shared/site.css"><link rel="stylesheet" href="../shared/mobile-site.css"></head><body><a class="skip" href="#guide">跳至指南</a><header class="topbar"><a href="../index.html">← 萌友遊戲館</a><nav><a href="#guide">遊戲指南</a><a href="#strategy">遊戲攻略</a><a class="primary" href="../play.html?game=${game.id}">開始遊戲</a></nav></header><main class="article"><div class="guide-hero"><span class="eyebrow">GAME ${String(game.id).padStart(2,'0')} · ${escape(game.genre)}</span>${logo ? `<img src="../${logo}" alt="${escape(game.title)}" class="guide-logo">` : ''}<p>${escape(game.summary)}</p></div><section id="guide">${markdown(guide, `../${base}/`)}</section><section id="strategy">${markdown(strategy, `../${base}/`)}</section><footer><a href="../${base}/GUIDE.md" download>下載指南 Markdown</a> · <a href="../${base}/STRATEGY.md" download>下載攻略 Markdown</a><p><a href="Game${game.id === 1 ? 12 : game.id - 1}.html">← 上一款</a> · <a href="../index.html">遊戲館</a> · <a href="Game${game.id === 12 ? 1 : game.id + 1}.html">下一款 →</a></p></footer></main></body></html>`);
}
console.log('Built 12 guides, 12 strategies and 12 reading pages.');
