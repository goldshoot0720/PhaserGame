#!/usr/bin/env python3
"""Call a Phaser Game Agent MCP tool: pga.py <tool_name> '<json args>'"""
import json, sys, urllib.request

cfg = json.load(open('/Users/fengxiong/.claude.json'))
server = cfg['projects']['/Users/fengxiong/Documents/PhaserGame']['mcpServers']['phaser-game-agent']
body = {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": sys.argv[1], "arguments": json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}}}
req = urllib.request.Request(server['url'], data=json.dumps(body).encode(), method='POST', headers={
    'Authorization': server['headers']['Authorization'], 'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'})
raw = urllib.request.urlopen(req, timeout=600).read().decode()
if raw.startswith('event:') or 'data:' in raw[:20]:
    raw = next(l[5:] for l in raw.splitlines() if l.startswith('data:'))
res = json.loads(raw)
if 'error' in res:
    print(json.dumps(res['error'], ensure_ascii=False)); sys.exit(1)
for c in res['result'].get('content', []):
    print(c.get('text', c))
