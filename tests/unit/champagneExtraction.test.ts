import { afterEach,describe,expect,it,vi } from 'vitest';
import app from '../../worker/structureEntry';
import { createSession } from '../../src/lib/auth/session';
import { migratedSqliteD1 } from './support/sqliteD1';
import { isChampagne,missingChampagneDetails,type ChampagneExtractionStatus } from '../../src/lib/wine/champagneExtraction';
import type { ChampagneExtractionJob } from '../../worker/champagneExtraction';
import { postGeminiGenerateContent } from '../../worker/geminiTransport';
import { createGeminiBatch,fetchGeminiBatch } from '../../src/lib/research/geminiBatch';

vi.mock('../../worker/geminiTransport',async original=>({...await original<typeof import('../../worker/geminiTransport')>(),postGeminiGenerateContent:vi.fn()}));
vi.mock('../../src/lib/research/geminiBatch',async original=>({...await original<typeof import('../../src/lib/research/geminiBatch')>(),createGeminiBatch:vi.fn(),fetchGeminiBatch:vi.fn()}));
const SECRET='test-secret-value-long-enough-for-hmac';
const databases:Array<ReturnType<typeof migratedSqliteD1>>=[];
const reply=(details:unknown)=>({candidates:[{content:{parts:[{text:JSON.stringify({details})}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:30}});
function setup(gateway=true){
  const state=migratedSqliteD1();databases.push(state);
  state.sqlite.exec("INSERT INTO wines(id,owner_id,producer,wine_name,region,appellation,wine_style,created_at,updated_at) VALUES('w','owner','Krug','Grande Cuvee','Champagne','Champagne','sparkling','2026-01-01','2026-01-01')");
  state.sqlite.exec("INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,created_at) VALUES('photo','owner','w','original','image/jpeg',100,1000,1000,'uploaded','2026-01-01')");
  state.sqlite.exec("INSERT INTO wine_sparkling_details(owner_id,wine_id,details_json,updated_at) VALUES('owner','w','{\"dosageGPerL\":0}','2026-01-01')");
  const objects=new Map<string,string>();
  const bucket={put:vi.fn(async(key:string,value:string)=>{objects.set(key,value)}),get:vi.fn(async(key:string)=>objects.has(key)?{text:async()=>objects.get(key)!}:null),delete:vi.fn(async(key:string)=>{objects.delete(key)})};
  const jobs:ChampagneExtractionJob[]=[];
  const queue={send:vi.fn(async(job:ChampagneExtractionJob)=>{jobs.push(job)})};
  const env={DB:state.db,WINE_IMAGES:bucket,RESEARCH_QUEUE:queue,AUTH_SECRET:SECRET,GEMINI_API_KEY:'test-key',...(gateway?{CF_AI_GATEWAY_TOKEN:'token',AI_GATEWAY_ACCOUNT_ID:'account',AI_GATEWAY_ID:'gateway',VERTEX_PROJECT_ID:'project',VERTEX_REGION:'global'}:{})};
  async function request(method='POST',owner='owner',ids=['photo']){
    const form=new FormData();form.set('imageIds',JSON.stringify(ids));ids.forEach(()=>form.append('images',new File([new Uint8Array(30)],'label.jpg',{type:'image/jpeg'})));
    return app.fetch(new Request('https://x/api/wines/w/champagne-extraction',{method,headers:owner?{Authorization:`Bearer ${await createSession(owner,SECRET)}`}:{},body:method==='POST'?form:undefined}),env as never,{} as never);
  }
  async function process(job=jobs.find(job=>!job.cleanup)!){
    const ack=vi.fn(),retry=vi.fn();await app.queue({messages:[{body:job,ack,retry}]} as never,env as never);return {ack,retry};
  }
  async function status(){return (await (await request('GET')).json() as {run:ChampagneExtractionStatus|null}).run}
  return {...state,env,objects,bucket,jobs,queue,request,process,status};
}
afterEach(()=>{databases.splice(0).forEach(state=>state.sqlite.close());vi.clearAllMocks()});

describe('Champagne eligibility and non-destructive suggestions',()=>{
  it('accepts Champagne with unknown style but excludes other sparkling wines and Cognac',()=>{
    expect(isChampagne({appellation:'Champagne AOC',wineStyle:null})).toBe(true);
    expect(isChampagne({region:'Champagne',wineStyle:'sparkling'})).toBe(true);
    for(const appellation of ['Cava','Prosecco','Fine Champagne','Coteaux Champenois'])expect(isChampagne({region:'Champagne',appellation,wineStyle:'sparkling'})).toBe(false);
    expect(isChampagne({appellation:'Champagne',wineStyle:'white'})).toBe(false);
  });
  // A grower bottle rarely says just 'Champagne'. The cru and blanc-de-blancs
  // appellations are still Champagne, and hiding photo backfill from them was
  // the difference between the button appearing and the wine looking ineligible.
  it('accepts cru and blanc-de-blancs Champagne appellations',()=>{
    for(const appellation of ['Champagne Grand Cru','Champagne Premier Cru','Champagne 1er Cru','Champagne Blanc de Blancs','AOC Champagne Grand Cru'])
      expect(isChampagne({region:'Champagne',appellation,wineStyle:'sparkling'})).toBe(true);
  });
  // The appellation on a Champagne is always 'Champagne', so the village is what
  // ends up in the appellation column. A grower bottle from Ambonnay is the
  // common case, not the edge one.
  it('accepts a Champagne village in the appellation column',()=>{
    for(const appellation of ['Ambonnay','Bouzy','Aÿ','Ay','Verzenay','Le Mesnil-sur-Oger','Mailly-Champagne'])
      expect(isChampagne({region:'Champagne',appellation,wineStyle:'sparkling'})).toBe(true);
    // The village alone resolves to Champagne, so a blank region still qualifies.
    expect(isChampagne({appellation:'Aÿ',wineStyle:'sparkling'})).toBe(true);
    expect(isChampagne({appellation:'Cramant',wineStyle:null})).toBe(true);
  });
  // Style is one choice and offers no "sparkling rosé", so a rosé Champagne is
  // filed under rose at least as often as under sparkling. It carries the same
  // dosage, disgorgement and tirage, so it has to reach the same form.
  it('accepts a rosé Champagne filed under the rose style',()=>{
    for(const wineStyle of ['rose','rosé','Rose'])
      expect(isChampagne({region:'Champagne',wineStyle})).toBe(true);
    expect(isChampagne({region:'Champagne',appellation:'Ambonnay',wineStyle:'rose'})).toBe(true);
    // Rose alone is not a passport: the place still has to be Champagne.
    expect(isChampagne({region:'Provence',appellation:'Bandol',wineStyle:'rose'})).toBe(false);
    // And the region's own still rosé stays out, named as what it is.
    expect(isChampagne({region:'Champagne',appellation:'Rosé des Riceys',wineStyle:'rose'})).toBe(false);
  });
  // Champagne also makes still and fortified wine. None of it has a dosage or a
  // disgorgement date, so the release form must stay shut for them.
  it('rejects the still and fortified wines of the Champagne region',()=>{
    for(const appellation of ['Coteaux Champenois','Rosé des Riceys','Rose des Riceys','Ratafia de Champagne','Ratafia Champenois','Marc de Champagne','Fine de Champagne'])
      expect(isChampagne({region:'Champagne',appellation,wineStyle:'sparkling'})).toBe(false);
    expect(isChampagne({region:'Champagne',wineStyle:'fortified'})).toBe(false);
    expect(isChampagne({region:'Champagne',wineStyle:'red'})).toBe(false);
  });
  it('preserves zero and existing text while filling only missing values',()=>{
    expect(missingChampagneDetails({dosageGPerL:0,disgorgement:'Original'},{dosageGPerL:3,disgorgement:'Changed',tirage:'2020',lotCode:' '})).toEqual({tirage:'2020'});
  });
});

describe('Champagne extraction through the deployed entrypoint',()=>{
  it('authorizes the wine and its photos before creating any jobs',async()=>{
    const s=setup();
    expect((await s.request('POST','')).status).toBe(401);
    expect((await s.request('POST','foreign')).status).toBe(404);
    expect((await s.request('POST','owner',['other-photo'])).status).toBe(400);
    s.sqlite.exec("UPDATE wines SET appellation='Cava'");
    expect((await s.request()).status).toBe(400);
    expect(s.jobs).toHaveLength(0);expect(s.objects.size).toBe(0);
  });
  it('queues once, persists a Flex result, meters it once, and never edits the wine',async()=>{
    const s=setup();
    vi.mocked(postGeminiGenerateContent).mockResolvedValue({provider:'vertex-ai-gateway',response:new Response(JSON.stringify(reply({dosageGPerL:3,tirage:'2020'})))});
    expect((await s.request()).status).toBe(202);
    expect((await s.request()).status).toBe(202);
    expect(s.jobs.filter(job=>!job.cleanup)).toHaveLength(1);
    expect(s.objects.size).toBe(1);
    await s.process();await s.process();
    expect(postGeminiGenerateContent).toHaveBeenCalledTimes(1);
    const call=vi.mocked(postGeminiGenerateContent).mock.calls[0];
    expect(call[1]).toBe('gemini-3.1-flash-lite');expect(call[5]).toMatchObject({serviceTier:'flex'});
    expect(JSON.parse(call[2])).not.toHaveProperty('tools');
    expect(await s.status()).toMatchObject({status:'complete',details:{dosageGPerL:3,tirage:'2020'}});
    expect(s.sqlite.prepare('SELECT details_json FROM wine_sparkling_details').get()).toMatchObject({details_json:'{"dosageGPerL":0}'});
    expect(s.sqlite.prepare('SELECT tier,requests FROM ai_usage_events').all()).toEqual([expect.objectContaining({tier:'flex',requests:1})]);
    expect(s.objects.size).toBe(0);
  });
  it('submits native Batch once and resumes polling without resubmission',async()=>{
    const s=setup(false);vi.mocked(createGeminiBatch).mockResolvedValue('batches/test');
    vi.mocked(fetchGeminiBatch).mockResolvedValueOnce({ok:true,state:'JOB_STATE_PENDING',payload:{},responses:[]});
    await s.request();await s.process();expect(await s.status()).toMatchObject({status:'submitted'});
    await s.process();
    const run=(await s.status())!;
    vi.mocked(fetchGeminiBatch).mockResolvedValue({ok:true,state:'JOB_STATE_SUCCEEDED',payload:{},responses:[{metadata:{key:run.requestId},response:reply({disgorgement:'03/2024'})}]});
    await s.process();await s.process();
    expect(createGeminiBatch).toHaveBeenCalledTimes(1);
    expect(await s.status()).toMatchObject({status:'complete',details:{disgorgement:'03/2024'}});
    expect(s.sqlite.prepare('SELECT tier FROM ai_usage_events').get()).toMatchObject({tier:'batch'});
  });
  it('records malformed paid responses as failed and permits explicit retry',async()=>{
    const s=setup();vi.mocked(postGeminiGenerateContent).mockResolvedValue({provider:'vertex-ai-gateway',response:new Response(JSON.stringify(reply({dosageGPerL:-3})))});
    await s.request();await s.process();
    expect(await s.status()).toMatchObject({status:'failed'});
    expect(s.sqlite.prepare('SELECT count(*) AS n FROM ai_usage_events').get()).toMatchObject({n:1});
    expect(s.objects.size).toBe(0);
    expect((await s.request()).status).toBe(202);expect(await s.status()).toMatchObject({status:'queued'});
  });
  it('cleans staged photos when queue submission fails',async()=>{
    const s=setup();s.queue.send.mockRejectedValueOnce(new Error('Queue unavailable'));
    expect((await s.request()).status).toBe(503);
    expect(await s.status()).toMatchObject({status:'failed'});expect(s.objects.size).toBe(0);
  });
  it('does not repeat an in-flight submission and recovers stale processing visibly',async()=>{
    const s=setup();await s.request();s.sqlite.exec("UPDATE wine_champagne_extractions SET status='running'");
    await s.process();expect(postGeminiGenerateContent).not.toHaveBeenCalled();expect(s.objects.size).toBe(1);
    s.sqlite.exec("UPDATE wine_champagne_extractions SET updated_at='2020-01-01'");
    expect(await s.status()).toMatchObject({status:'failed',error:expect.stringContaining('interrupted')});
  });
  it('cleans orphaned prepared photos when the wine was deleted',async()=>{
    const s=setup();await s.request();s.sqlite.exec("DELETE FROM wines WHERE id='w'");
    await s.process();expect(s.objects.size).toBe(0);expect(postGeminiGenerateContent).not.toHaveBeenCalled();
  });
});
