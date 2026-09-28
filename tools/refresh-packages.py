#!/usr/bin/env python3
"""Download complete published game packages; preserve the bundled engine license."""
import concurrent.futures, json, re, urllib.request
from pathlib import Path
games = json.loads(Path('shared/catalog.json').read_text())
def fetch(game):
    page = urllib.request.urlopen('https://phaser.games/play/' + game['project'], timeout=60).read().decode()
    found = re.search(r'await import\("([^"]+)"\)', page)
    if not found: raise RuntimeError('No published bundle for ' + str(game['id']))
    url = 'https://phaser.games' + found.group(1)
    data = urllib.request.urlopen(url, timeout=120).read()
    if not data.startswith(b'/*\n * Phaser AE'): raise RuntimeError('Invalid package')
    Path(f'.cache/Game{game["id"]}-bundle.js').write_bytes(data)
    print(f'Game{game["id"]}: {len(data)} bytes', flush=True)
    return {k: game[k] for k in ('id','project','title','genre','summary')} | {'bundleUrl': url}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    result = list(pool.map(fetch, games))
Path('.cache/versions.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
