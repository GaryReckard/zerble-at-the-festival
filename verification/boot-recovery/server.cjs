const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve('dist');
let remaining = 0;
http.createServer((req,res) => {
 const url = new URL(req.url,'http://localhost');
 if (url.searchParams.has('fault') && !url.searchParams.has('_bootRetry')) remaining = url.searchParams.get('fault') === 'always' ? Infinity : 1;
 if (/\/main-[^/]+\.js$/.test(url.pathname) && remaining > 0) {
   remaining--; console.log('Injected 503:',url.pathname); res.writeHead(503,{'Cache-Control':'no-store'}); res.end('Test service unavailable'); return;
 }
 const relative = decodeURIComponent(url.pathname).replace(/^\/zerble-at-the-festival\//,'/');
 const file = path.resolve(root,'.'+relative+(relative.endsWith('/')?'index.html':''));
 if (!file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,data)=>{
 if(err){res.writeHead(404);res.end();return;}
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 });
}).listen(8766,'127.0.0.1',()=>console.log('Boot failure fixture on 127.0.0.1:8766'));
