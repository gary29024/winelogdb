import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import {readFileSync} from 'node:fs';
import { fillShell,shellFiles,shellVersion } from './src/lib/offline/shellFiles';
import losslessMaps from './src/lib/places/burgundyLosslessMapRegistry.json';

// The plain Vite test server does not run the Worker. Mirror the registered
// maps' HTTP encoding here; worker-runtime-smoke verifies the real handler.
const losslessUrls=new Map(Object.values(losslessMaps).flatMap(m=>[[m.brotliJsonUrl,'br'] as const,[m.gzipJsonUrl,'gzip'] as const]));
// Writes /sw.js beside the built app: the service worker template with the list
// of files this build produced, so the phone keeps exactly this release.
const offlineShell={
 name:'winelog-offline-shell',
 applyToEnvironment:(environment:{name:string})=>environment.name==='client',
 generateBundle(this:{emitFile(file:{type:'asset';fileName:string;source:string}):void},_options:unknown,bundle:Record<string,unknown>){
  const files=shellFiles(Object.keys(bundle));
  const template=readFileSync(new URL('./src/lib/offline/serviceWorker.template.js',import.meta.url),'utf8');
  this.emitFile({type:'asset',fileName:'sw.js',source:fillShell(template,{version:shellVersion(files),files})});
 },
};
export default defineConfig(({mode})=>({plugins:[react(),offlineShell,...(mode==='test'?[{
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
