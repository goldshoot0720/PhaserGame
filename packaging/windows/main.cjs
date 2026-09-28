const { app, BrowserWindow, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let server;
app.whenReady().then(() => {
  const root = path.join(__dirname, 'site');
  const mime = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.md':'text/plain; charset=utf-8', '.ts':'text/plain; charset=utf-8' };
  server = http.createServer((req,res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = path.resolve(root, '.' + pathname);
      if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
      if (fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
      const size = fs.statSync(file).size;
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': size});
      fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
    } catch { res.writeHead(404).end(); }
  });
  server.listen(0,'127.0.0.1',() => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const win = new BrowserWindow({width:1366,height:900,minWidth:800,minHeight:600,title:'萌友遊戲館',backgroundColor:'#10162a',autoHideMenuBar:true,
      webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
    win.webContents.setWindowOpenHandler(({url})=> { if(url.startsWith('https://'))shell.openExternal(url); return {action:'deny'}; });
    win.webContents.on('will-navigate',(event,url)=> {if(!url.startsWith(origin+'/')){event.preventDefault();if(url.startsWith('https://'))shell.openExternal(url);}});
    win.loadURL(origin+'/index.html');
  });
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>server?.close());
