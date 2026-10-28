const http=require('http'),fs=require('fs'),path=require('path');
http.createServer((q,r)=>{const f=path.join(__dirname,'..',decodeURIComponent(q.url.split('?')[0])==='/'?'Nomination Form Filler.html':decodeURIComponent(q.url.split('?')[0]));
fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});r.end(d)})}).listen(5177,'127.0.0.1');
