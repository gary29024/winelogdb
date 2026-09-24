import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const host='127.0.0.1';
const port=8788;
const origin=`http://${host}:${port}`;
const wranglerCli=fileURLToPath(new globalThis.URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
const authSecret='platform-smoke-auth-secret-0123456789abcdef';
const navigationHeaders={
  accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'sec-fetch-dest':'document',
  'sec-fetch-mode':'navigate',
  'sec-fetch-site':'same-origin',
};
const args=[
  'dev','--local','--ip',host,'--port',String(port),
  ...(process.env.WINELOG_SMOKE_PERSIST_TO?['--persist-to',process.env.WINELOG_SMOKE_PERSIST_TO]:[]),
  '--var',`APP_URL:${origin}`,
  '--var','SUPPORT_EMAIL:support@example.com',
  '--var','GOOGLE_CLIENT_ID:smoke.apps.googleusercontent.com',
  '--var','GOOGLE_CLIENT_SECRET:smoke-client-secret',
  '--var','OWNER_EMAIL:owner@example.com',
  '--var',`AUTH_SECRET:${authSecret}`,
];

function stripJsonc(source){
  return source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
}
function assertWorkerFirstConfig(){
  const config=JSON.parse(stripJsonc(readFileSync('wrangler.jsonc','utf8')));
  const runWorkerFirst=config.assets?.run_worker_first;
  if(!Array.isArray(runWorkerFirst)||!runWorkerFirst.includes('/api/*')){
    throw new Error('wrangler.jsonc must keep assets.run_worker_first containing /api/* so deployed SPA assets cannot intercept API navigation.');
  }
}

// Wrangler local dev does not reproduce Cloudflare's deployed asset-router
// precedence. Assert the production routing invariant explicitly, then use the
// local server to exercise Worker/OAuth/JSON/SPA behavior behind that contract.
assertWorkerFirstConfig();

// Spawn Wrangler directly rather than through npx. The npx wrapper can exit
// separately from Wrangler and leave the actual dev server alive in CI.
const detached=process.platform!=='win32';
const child=spawn(process.execPath,[wranglerCli,...args],{
  stdio:['ignore','pipe','pipe'],
  env:{...process.env,CI:'1'},
  detached,
});
let output='';
for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{
  const text=String(chunk);
  output=(output+text).slice(-12000);
  process.stdout.write(text);
});

const fail=message=>{throw new Error(`${message}\n\nRecent Wrangler output:\n${output}`)};
async function request(path,init={}){
  const options={redirect:'manual',...init};
  if(!options.signal)options.signal=globalThis.AbortSignal.timeout(5000);
  return globalThis.fetch(`${origin}${path}`,options);
}
async function waitUntilReady(){
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)fail(`wrangler dev exited early with code ${child.exitCode}`);
    try{
      const response=await request('/api/public/config',{headers:navigationHeaders});
      if(response.status)return;
    }catch{}
    await sleep(250);
  }
  fail('wrangler dev did not become ready within 30 seconds');
}
function expect(condition,message){if(!condition)fail(message)}
async function expectJson(response,label,status){
  expect(response.status===status,`${label}: expected ${status}, got ${response.status}`);
  const contentType=response.headers.get('content-type')||'';
  expect(contentType.includes('application/json'),`${label}: expected JSON, got ${contentType||'no content-type'}`);
  return response.json();
}
function signalChild(signal){
  if(child.exitCode!==null)return;
  if(process.platform==='win32'){
    child.kill(signal);
    return;
  }
  try{
    // detached:true creates a process group, so this stops Wrangler and all of
    // its local runtime children rather than only the immediate Node process.
    process.kill(-child.pid,signal);
  }catch(error){
    if(error?.code!=='ESRCH')throw error;
  }
}
async function waitForExit(milliseconds){
  if(child.exitCode!==null)return;
  await Promise.race([once(child,'exit'),sleep(milliseconds)]);
}
async function stopChild(){
  if(child.exitCode===null){
    signalChild('SIGTERM');
    await waitForExit(1500);
  }
  if(child.exitCode===null){
    signalChild('SIGKILL');
    await waitForExit(1000);
  }
  child.stdout.destroy();
  child.stderr.destroy();
}

// This is a release gate, not a long-running service. Even a future Wrangler
// regression must fail fast instead of consuming the whole CI job timeout.
const watchdog=globalThis.setTimeout(()=>{
  globalThis.console.error('Worker runtime smoke exceeded 60 seconds.');
  try{signalChild('SIGKILL');}catch{}
  process.exit(1);
},60000);

let exitCode=0;
try{
  await waitUntilReady();

  const config=await request('/api/public/config',{headers:navigationHeaders});
  const configBody=await expectJson(config,'browser navigation to public config',200);
  expect(configBody.supportEmail==='support@example.com','public config did not come from the Worker');

  const start=await request('/api/auth/google/start',{headers:navigationHeaders});
  expect(start.status===302,`Google OAuth start: expected 302, got ${start.status}`);
  const location=start.headers.get('location');
  expect(Boolean(location),'Google OAuth start: missing Location header');
  const google=new globalThis.URL(location);
  expect(google.origin==='https://accounts.google.com','Google OAuth start did not redirect to Google');
  expect(google.searchParams.get('redirect_uri')===`${origin}/api/auth/google/callback`,'Google OAuth callback URI was not generated from APP_URL');

  const callback=await request('/api/auth/google/callback',{headers:navigationHeaders});
  await expectJson(callback,'browser navigation to OAuth callback',400);

  const me=await request('/api/me',{headers:{accept:'*/*'}});
  await expectJson(me,'unauthenticated /api/me',401);

  const unknownApi=await request('/api/auth/not-a-route',{headers:navigationHeaders});
  await expectJson(unknownApi,'unknown API navigation',404);

  const login=await request('/login',{headers:navigationHeaders});
  expect(login.status===200,`SPA /login: expected 200, got ${login.status}`);
  expect((login.headers.get('content-type')||'').includes('text/html'),'SPA /login did not return HTML');

  globalThis.console.log('Worker runtime smoke passed.');
}catch(error){
  exitCode=1;
  globalThis.console.error(error);
}finally{
  globalThis.clearTimeout(watchdog);
  try{
    await stopChild();
  }catch(error){
    exitCode=1;
    globalThis.console.error('Failed to stop Wrangler cleanly:',error);
  }
}

// Force a deterministic end after cleanup so an inherited runtime handle can
// never leave the CI step hanging after the assertions have finished.
process.exit(exitCode);
