import { afterEach,describe,expect,it,vi } from 'vitest';
import app from '../../worker/structureEntry';
import { createSession } from '../../src/lib/auth/session';
import { readVintageWindow } from '../../src/lib/maturity/vintageWindow';
import type { VintageResearchMessage } from '../../worker/vintageResearchJobs';
import { migratedSqliteD1 } from './support/sqliteD1';

const SECRET='test-secret-value-long-enough-for-hmac';
const subject={country:'France',region:'Burgundy',appellation:'Gevrey-Chambertin',vintage:2019,wineStyle:'red'};
const redirect='https://vertexaisearch.cloud.google.com/grounding-api-redirect/report';
const answer={drinkFrom:2024,drinkTo:2038,note:'A structured year in the Côte de Nuits.',
  quality:{score:93,confidence:'medium',consensus:'Broadly excellent.',strengths:['Freshness'],cautions:['Uneven yields']},
  sources:[{title:'Vintage report',url:redirect}]};
const payload=()=>({candidates:[{content:{parts:[{text:JSON.stringify(answer)}]},
  groundingMetadata:{groundingChunks:[{web:{title:'Vintage report',uri:redirect}}],webSearchQueries:['Burgundy 2019']}}],
  usageMetadata:{promptTokenCount:100,candidatesTokenCount:200}});
const databases:Array<ReturnType<typeof migratedSqliteD1>>=[];
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();for(const {sqlite} of databases.splice(0))sqlite.close()});

function setup(){
  const state=migratedSqliteD1();databases.push(state);
  const jobs:VintageResearchMessage[]=[];
  const send=vi.fn(async(job:VintageResearchMessage)=>{jobs.push(job)});
  const waitUntil=vi.fn();
  const env={DB:state.db,AUTH_SECRET:SECRET,APP_URL:'https://x',APP_PASSWORD:'p',GEMINI_API_KEY:'k',
    WINE_IMAGES:{put:async()=>undefined,delete:async()=>undefined},RESEARCH_QUEUE:{send},
    ASSETS:{fetch:async()=>new Response('spa')}} as never;
  const context={waitUntil,passThroughOnException:()=>undefined} as never;
  async function look(body:Record<string,unknown>={},owner='owner'){
    return app.fetch(new Request('https://x/api/maturity/vintage',{method:'POST',
      headers:{'content-type':'application/json',authorization:`Bearer ${await createSession(owner,SECRET)}`},
      body:JSON.stringify({...subject,...body})}),env,context);
  }
  async function progress(id:string,owner='owner'){
    return app.fetch(new Request(`https://x/api/maturity/vintage/jobs/${id}`,{
      headers:{authorization:`Bearer ${await createSession(owner,SECRET)}`}}),env,context);
  }
  async function consume(job=jobs[0]){
    const ack=vi.fn(),retry=vi.fn();
    await app.queue({messages:[{body:job,ack,retry,attempts:1}]} as never,env);
    expect(ack).toHaveBeenCalledOnce();expect(retry).not.toHaveBeenCalled();
  }
  const fetch=vi.fn(async()=>Response.json(payload()));vi.stubGlobal('fetch',fetch);
  return {...state,look,progress,consume,jobs,send,waitUntil,fetch,env};
}

describe('queued vintage research is independent of the requesting browser',()=>{
  it('accepts without starting a model request, then persists via the deployed queue entrypoint',async()=>{
    const {look,consume,progress,jobs,waitUntil,fetch,db}=setup();
    const response=await look();expect(response.status).toBe(202);
    expect(fetch).not.toHaveBeenCalled();expect(waitUntil).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({job:{id:jobs[0].requestId,status:'queued'},cached:false});
    // The HTTP request is finished; only the queue consumer now owns the work.
    await consume();
    expect(await readVintageWindow(db,'owner',subject)).toMatchObject({quality:{score:93}});
    expect(await (await progress(jobs[0].requestId)).json()).toMatchObject({job:{status:'complete',window:{quality:{score:93}}}});
  });
  it('finishes an escalation lasting longer than the HTTP waitUntil grace period',async()=>{
    const {look,consume,fetch,db}=setup();await look();
    vi.useFakeTimers();
    fetch.mockResolvedValueOnce(Response.json({candidates:[]}));
    fetch.mockImplementationOnce(()=>new Promise(resolve=>setTimeout(()=>resolve(Response.json(payload())),40_000)));
    const completion=consume();
    await vi.advanceTimersByTimeAsync(40_001);await completion;
    expect(await readVintageWindow(db,'owner',subject)).toMatchObject({quality:{score:93}});
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('shares active requests, ignores redeliveries, and serves the saved cell for free',async()=>{
    const {look,consume,send,fetch}=setup();
    const first=await (await look()).json() as {job:{id:string}};
    expect(await (await look({refresh:true})).json()).toMatchObject({job:{id:first.job.id}});
    expect(send).toHaveBeenCalledOnce();
    await consume();await consume();
    expect(fetch).toHaveBeenCalledOnce();
    expect(await (await look()).json()).toMatchObject({cached:true});
    expect(send).toHaveBeenCalledOnce();
  });
  it('queues an explicit refresh and preserves the previous result on failure',async()=>{
    const {look,consume,jobs,progress,fetch,db}=setup();
    await look();await consume();
    expect((await look({refresh:true})).status).toBe(202);
    expect(jobs).toHaveLength(2);
    fetch.mockImplementation(async()=>Response.json({candidates:[]}));
    await consume(jobs[1]);await consume(jobs[1]);
    expect(fetch).toHaveBeenCalledTimes(3); // initial success + two model attempts; no queue replay
    expect(await (await progress(jobs[1].requestId)).json()).toMatchObject({job:{status:'failed',error:expect.any(String)}});
    expect(await readVintageWindow(db,'owner',subject)).toMatchObject({quality:{score:93}});
  });
  it('reports enqueue failure without spending on a model and permits an explicit retry',async()=>{
    const {look,send,fetch,jobs}=setup();send.mockRejectedValueOnce(new Error('queue unavailable'));
    expect((await look()).status).toBe(503);expect(fetch).not.toHaveBeenCalled();
    expect((await look()).status).toBe(202);expect(jobs).toHaveLength(1);
  });
  it('isolates job results and active-cell deduplication by owner',async()=>{
    const {look,jobs,progress}=setup();await look();
    expect((await progress(jobs[0].requestId,'another-owner')).status).toBe(404);
    expect((await look({},'another-owner')).status).toBe(202);expect(jobs).toHaveLength(2);
  });
  it('lets the queue retry a database read failure before any paid attempt is claimed',async()=>{
    const {look,jobs,db,env,consume,fetch,sqlite}=setup();await look();
    const prepare=db.prepare.bind(db);let fail=true;
    vi.spyOn(db,'prepare').mockImplementation(sql=>{
      if(fail&&sql.startsWith('SELECT')&&sql.includes('FROM vintage_research_jobs')){fail=false;throw new Error('temporary D1 read failure')}
      return prepare(sql);
    });
    const ack=vi.fn(),retry=vi.fn();
    await app.queue({messages:[{body:jobs[0],ack,retry,attempts:1}]} as never,env);
    expect(retry).toHaveBeenCalledOnce();expect(ack).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
    expect(sqlite.prepare('SELECT status FROM vintage_research_jobs').get()?.status).toBe('queued');
    await consume();expect(fetch).toHaveBeenCalledOnce();
  });

  it('recovers an abandoned job only on an explicit new request',async()=>{
    const {look,jobs,sqlite,consume,fetch}=setup();await look();const old=jobs[0];
    sqlite.prepare("UPDATE vintage_research_jobs SET status='running',updated_at=? WHERE id=?")
      .run(new Date(Date.now()-11*60*1000).toISOString(),old.requestId);
    expect((await look()).status).toBe(202);expect(jobs).toHaveLength(2);
    await consume(old);expect(fetch).not.toHaveBeenCalled();
    await consume(jobs[1]);expect(fetch).toHaveBeenCalledOnce();
  });
});
