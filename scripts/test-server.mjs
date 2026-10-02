import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try {
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if(!file.startsWith(root)||!mime[path.extname(file)]||path.relative(root,file).split(path.sep).some(p=>p.startsWith('.'))){res.writeHead(403).end();return;}
  const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404).end();}
});
server.listen(4187,'127.0.0.1');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
