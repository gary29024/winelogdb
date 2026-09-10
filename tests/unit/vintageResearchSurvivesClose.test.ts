import { afterEach,describe,expect,it,vi } from 'vitest';
import app from '../../worker/cuveeEntry';
import { createSession } from '../../src/lib/auth/session';
import { readVintageWindow } from '../../src/lib/maturity/vintageWindow';
import { migratedSqliteD1 } from './support/sqliteD1';

/**
 * A grounded vintage lookup is the one button in the app that spends a search
 * and keeps the answer for every wine in that cell. It used to be awaited by
 * the request alone, so a locked phone or a closed tab cancelled the Worker
 * before the row was written - the search was paid for and nothing was cached,
 * so the next press paid for it again.
 */
const SECRET='test-secret-value-long-enough-for-hmac';
const subject={country:'France',region:'Burgundy',appellation:'Gevrey-Chambertin',vintage:2019,wineStyle:'red'};
const redirect='https://vertexaisearch.cloud.google.com/grounding-api-redirect/report';
const answer={drinkFrom:2024,drinkTo:2038,note:'A structured year in the Côte de Nuits.',
  quality:{score:93,confidence:'medium',consensus:'Broadly excellent.',strengths:['Freshness'],cautions:['Uneven yields']},
  sources:[{title:'Vintage report',url:redirect}]};

const databases:Array<ReturnType<typeof migratedSqliteD1>>=[];
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();for(const {sqlite} of databases.splice(0))sqlite.close()});

function setup(){
  const state=migratedSqliteD1();databases.push(state);
  const tasks:Array<Promise<unknown>>=[];
  const waitUntil=vi.fn((task:Promise<unknown>)=>{tasks.push(task)});
  const env={DB:state.db,AUTH_SECRET:SECRET,APP_URL:'https://x',APP_PASSWORD:'p',GEMINI_API_KEY:'k',
    WINE_IMAGES:{put:async()=>undefined,delete:async()=>undefined},
    ASSETS:{fetch:async()=>new Response('spa')}} as never;
  async function look(body:Record<string,unknown>={}){
    return app.fetch(new Request('https://x/api/maturity/vintage',{method:'POST',
      headers:{'content-type':'application/json',authorization:`Bearer ${await createSession('owner',SECRET)}`},
      body:JSON.stringify({...subject,...body})
    }),env,{waitUntil,passThroughOnException:()=>undefined} as never);
  }
  return {...state,tasks,waitUntil,look};
}

function grounded(){
  const fetch=vi.fn(async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify(answer)}]},
    groundingMetadata:{groundingChunks:[{web:{title:'Vintage report',uri:redirect}}],webSearchQueries:['Burgundy 2019']}}],
    usageMetadata:{promptTokenCount:100,candidatesTokenCount:200}}));
  vi.stubGlobal('fetch',fetch);
  return fetch;
}

describe('a paid vintage lookup outlives the browser that asked for it',()=>{
  it('registers the research so a closed tab cannot cancel it, and still answers', async()=>{
    const {look,tasks,waitUntil,db}=setup();grounded();
    const response=await look();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({cached:false,window:{shiftFrom:expect.any(Number)}});
    // One registration, and it is the research itself rather than a copy that
    // resolves early: the row is only written when that task has finished.
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(tasks).toHaveLength(1);
    await expect(Promise.all(tasks)).resolves.toBeTruthy();
    expect(await readVintageWindow(db,'owner',subject)).toMatchObject({quality:{score:93}});
  });

  it('spends nothing and registers nothing when the cell is already researched',async()=>{
    const {look,waitUntil}=setup();const fetch=grounded();
    expect((await look()).status).toBe(200);
    waitUntil.mockClear();
    expect(await (await look()).json()).toMatchObject({cached:true});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it('registers the refresh too, because it spends a second search',async()=>{
    const {look,waitUntil}=setup();grounded();
    expect((await look()).status).toBe(200);
    waitUntil.mockClear();
    expect(await (await look({refresh:true})).json()).toMatchObject({cached:false});
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('reports a refused lookup without leaving the registered task rejected',async()=>{
    const {look,tasks}=setup();
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({...answer,sources:[]})}]}}]})));
    const response=await look();
    expect(response.status).toBe(502);
    // An unhandled rejection inside waitUntil takes the whole invocation down,
    // so the registered task swallows what the response already reported.
    await expect(Promise.all(tasks)).resolves.toEqual([undefined]);
  });
});
