const grid = document.getElementById('games');
const search = document.getElementById('search');
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
try {
  const response = await fetch('shared/catalog.json');
  if (!response.ok) throw Error('catalog unavailable');
  const games = await response.json();
  let filter = '全部';
  const cast = document.getElementById('cast');
  const names = ['汐音', '小冰', '光哉', '阿翔', '小花', '書白', '緋音', '澪'];
  games[0].assets.filter(a => a.url.includes('/cast-')).forEach((asset, i) => {
    const card = el('div', '', 'cast-card'); const img = el('img'); img.src = asset.file; img.alt = names[i];
    card.append(img, el('span', names[i])); cast.append(card);
  });
  const filters = document.getElementById('filters');
  for (const type of ['全部', ...new Set(games.map(g => g.genre))]) {
    const b = el('button', type); b.type = 'button'; b.setAttribute('aria-pressed', String(type === filter));
    b.onclick = () => { filter = type; for (const item of filters.children) item.setAttribute('aria-pressed', String(item === b)); render(); };
    filters.append(b);
  }
  function render() {
    const query = search.value.trim().toLowerCase();
    const visible = games.filter(g => (filter === '全部' || g.genre === filter) && `${g.title} ${g.genre} Game${g.id}`.toLowerCase().includes(query));
    grid.replaceChildren();
    for (const game of visible) {
      const card = el('article', '', 'game-card'); card.style.setProperty('--hue', String((game.id * 37 + 175) % 360));
      const art = el('a', '', 'card-art'); art.href = `play.html?game=${game.id}`; art.setAttribute('aria-label', `開始${game.title}`);
      const logo = el('img'); logo.src = game.logo; logo.alt = ''; logo.loading = 'lazy';
      art.append(el('span', String(game.id).padStart(2, '0'), 'card-number'), logo);
      const body = el('div', '', 'card-body'); body.append(el('span', game.genre, 'tag'), el('h3', game.title), el('p', game.summary));
      const links = el('div', '', 'card-links'); const play = el('a', '開始遊戲 ↗', 'play-link'); play.href = art.href;
      const guide = el('a', '指南與攻略'); guide.href = `guides/Game${game.id}.html`;
      links.append(play, guide); body.append(links); card.append(art, body); grid.append(card);
    }
    document.getElementById('result-count').textContent = `共 ${visible.length} 款遊戲`;
    document.getElementById('empty').hidden = visible.length !== 0;
  }
  search.addEventListener('input', render); render();
} catch {
  grid.textContent = '無法讀取遊戲清單。請在專案資料夾執行 npm run dev，再開啟 http://127.0.0.1:8787。';
}
