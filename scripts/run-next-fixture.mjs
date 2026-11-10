import next from 'next';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
const app=next({dev:true,webpack:true,dir:resolve('examples/next-app'),hostname:'127.0.0.1'});
await app.prepare();
const server=createServer(app.getRequestHandler());
server.listen(0,'127.0.0.1',()=>console.log(`STACKFLOW_FIXTURE_URL=http://127.0.0.1:${server.address().port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{server.close();await app.close();process.exit(0);});
