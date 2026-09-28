import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import {readFileSync} from 'node:fs';
import losslessMaps from './src/lib/places/burgundyLosslessMapRegistry.json';

// The plain Vite test server does not run the Worker. Mirror the registered
// maps' HTTP encoding here; worker-runtime-smoke verifies the real handler.
const losslessUrls=new Map(Object.values(losslessMaps).flatMap(m=>[[m.brotliJsonUrl,'br'] as const,[m.gzipJsonUrl,'gzip'] as const]));
export default defineConfig(({mode})=>({plugins:[react(),...(mode==='test'?[{
 name:'lossless-map-test-assets',
 configureServer(server){server.middlewares.use((request,response,next)=>{
  const path=request.url?.split('?')[0];
  if(!path||!losslessUrls.has(path)){next();return;}
  const body=readFileSync(new URL(`./public${path}`,import.meta.url));
  response.setHeader('Content-Type','application/geo+json; charset=utf-8');
  response.setHeader('Content-Encoding',losslessUrls.get(path)!);
  response.setHeader('Cache-Control','public, max-age=31536000, immutable, no-transform');
  response.setHeader('Content-Length',body.length);
  response.end(request.method==='HEAD'?undefined:body);
 });},
}]:[cloudflare()])]}));
