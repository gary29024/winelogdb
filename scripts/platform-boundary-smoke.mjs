import { spawn } from 'node:child_process';

const host='127.0.0.1';
const port=8788;
const origin=`http://${host}:${port}`;
const npx=process.platform==='win32'?'npx.cmd':'npx';
const authSecret='platform-smoke-auth-secret-0123456789abcdef';
const args=[
  'wrangler','dev','--local','--ip',host,'--port',String(port),
  '--var',`APP_URL:${origin}`,
  '--var','SUPPORT_EMAIL:support@example.com',
  '--var','GOOGLE_CLIENT_ID:smoke.apps.googleusercontent.com',
  '--var','GOOGLE_CLIENT_SECRET:smoke-client-secret',
  '--var','OWNER_EMAIL:owner@example.com',
  '--var',`AUTH_SECRET:${authSecret}`,
];

const child=spawn(npx,args,{stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'1'}});
let output='';
for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{
  const text=String(chunk);
  output=(output+text).slice(-12000);
  process.stdout.write(text);
});

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fail=message=>{throw new Error(`${message}\n\nRecent Wrangler output:\n${output}`)};
async function request(path,init={}){
  return fetch(`${origin}${path}`,{redirect:'manual',...init});
}
async function waitUntilReady(){
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)fail(`wrangler dev exited early with code ${child.exitCode}`);
    try{
      const response=await request('/api/public/config',{headers:{accept:'text/html'}});
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

try{
  await waitUntilReady();

  const config=await request('/api/public/config',{headers:{accept:'text/html'}});
  const configBody=await expectJson(config,'browser navigation to public config',200);
  expect(configBody.supportEmail==='support@example.com','public config did not come from the Worker');

  const start=await request('/api/auth/google/start',{headers:{accept:'text/html'}});
  expect(start.status===302,`Google OAuth start: expected 302, got ${start.status}`);
  const location=start.headers.get('location');
  expect(Boolean(location),'Google OAuth start: missing Location header');
  const google=new URL(location);
  expect(google.origin==='https://accounts.google.com','Google OAuth start did not redirect to Google');
  expect(google.searchParams.get('redirect_uri')===`${origin}/api/auth/google/callback`,'Google OAuth callback URI was not generated from APP_URL');

  const callback=await request('/api/auth/google/callback',{headers:{accept:'text/html'}});
  await expectJson(callback,'browser navigation to OAuth callback',400);

  const me=await request('/api/me',{headers:{accept:'*/*'}});
  await expectJson(me,'unauthenticated /api/me',401);

  const unknownApi=await request('/api/auth/not-a-route',{headers:{accept:'text/html'}});
  await expectJson(unknownApi,'unknown API navigation',404);

  const login=await request('/login',{headers:{accept:'text/html'}});
  expect(login.status===200,`SPA /login: expected 200, got ${login.status}`);
  expect((login.headers.get('content-type')||'').includes('text/html'),'SPA /login did not return HTML');

  console.log('Platform boundary smoke passed.');
} finally {
  if(child.exitCode===null){
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve=>child.once('exit',resolve)),
      sleep(3000).then(()=>{if(child.exitCode===null)child.kill('SIGKILL');}),
    ]);
  }
}
