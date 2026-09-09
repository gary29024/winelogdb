import { afterEach,describe,expect,it,vi } from 'vitest';
import app from '../../worker/structureEntry';
import { createSession } from '../../src/lib/auth/session';
import { migratedSqliteD1 } from './support/sqliteD1';

const SECRET='test-secret-value-long-enough-for-hmac';
const blank={producer:'Test estate',wineName:'Test wine',vintage:2020,country:null,region:null,appellation:null,recognizedRegion:null,recognizedAppellation:null,classification:null,classificationOverride:null,grapes:[],grapeBlend:[],wineStyle:'red',alcoholPercentage:null,tastingNotes:'',rating:null,tastingDate:null,tastingName:null,event:null,venue:null,locationName:null,latitude:null,longitude:null,price:null,currency:null,tags:[],recognitionStatus:'complete',recognitionConfidence:null};
const rich={...blank,tastingNotes:'Original note',rating:92,tastingDate:'2026-09-01',tastingName:'Original tasting',venue:'Home',tastingStructure:{acidity:'high'}};
const databases:Array<ReturnType<typeof migratedSqliteD1>>=[];
function setup(){
  const state=migratedSqliteD1();databases.push(state);
  const bucket={put:vi.fn(async()=>undefined),delete:vi.fn(async()=>undefined)};
  async function request(method:string,path:string,body?:unknown,multipart=false,owner='owner'){
    return app.fetch(new Request(`https://x${path}`,{method,headers:{authorization:`Bearer ${await createSession(owner,SECRET)}`,...(multipart?{}:{'content-type':'application/json'})},body:body===undefined?undefined:multipart?body as FormData:JSON.stringify(body)}),{DB:state.db,WINE_IMAGES:bucket,AUTH_SECRET:SECRET,APP_PASSWORD:'p',APP_URL:'https://x',ASSETS:{fetch:async()=>new Response('spa')}} as never,{waitUntil:()=>{},passThroughOnException:()=>{}} as never);
  }
  async function create(body:unknown=rich){const response=await request('POST','/api/wines',body);expect(response.status,await response.clone().text()).toBe(201);return (await response.json() as {id:string}).id}
  return {...state,bucket,request,create};
}
afterEach(()=>{for(const state of databases.splice(0))state.sqlite.close();vi.restoreAllMocks()});

describe('wine saves through the deployed entrypoint and migrated SQLite',()=>{
  it('clears every experience field and does not reveal an older experience',async()=>{
    const {sqlite,create,request}=setup(),id=await create();
    sqlite.prepare("INSERT INTO wine_experiences(id,owner_id,wine_id,tasting_notes,created_at,updated_at) VALUES('older','owner',?,'Older note','2020-01-01','2020-01-01')").run(id);
    expect((await request('PUT',`/api/wines/${id}`,{...blank,tastingStructure:null})).status).toBe(200);
    const response=await request('GET',`/api/wines/${id}`),wine=await response.json();
    expect(wine).toMatchObject({tastingNotes:'',rating:null,tastingDate:null,tastingName:null,locationName:null,tastingStructure:null});
    expect(sqlite.prepare('SELECT count(*) AS n FROM wine_experiences').get()).toMatchObject({n:2});
    expect(sqlite.prepare("SELECT tasting_notes FROM wine_experiences WHERE id='older'").get()).toMatchObject({tasting_notes:'Older note'});
  });
  it('does not manufacture an experience for an empty wine',async()=>{
    const {sqlite,create,request}=setup(),id=await create(blank);
    expect((await request('PUT',`/api/wines/${id}`,blank)).status).toBe(200);
    expect(sqlite.prepare('SELECT count(*) AS n FROM wine_experiences').get()).toMatchObject({n:0});
  });
  it('preserves omitted structure and clears only the requested experience fields',async()=>{
    const {create,request}=setup(),id=await create();
    expect((await request('PUT',`/api/wines/${id}`,{...blank,rating:85})).status).toBe(200);
    expect(await (await request('GET',`/api/wines/${id}`)).json()).toMatchObject({rating:85,tastingNotes:'',tastingName:null,tastingStructure:{acidity:'high'}});
  });
  it('rolls back the wine, experience and newly named tasting if structure fails',async()=>{
    const {sqlite,create,request}=setup(),id=await create();
    sqlite.exec("CREATE TRIGGER reject_structure BEFORE INSERT ON wine_tasting_structures BEGIN SELECT RAISE(ABORT,'Simulated structure failure'); END");
    const response=await request('PUT',`/api/wines/${id}`,{...rich,wineName:'Changed',rating:40,tastingName:'New tasting',tastingStructure:{body:'full'}});
    expect(response.status).toBe(500);
    expect(await (await request('GET',`/api/wines/${id}`)).json()).toMatchObject({wineName:'Test wine',rating:92,tastingName:'Original tasting',tastingStructure:{acidity:'high'}});
    expect(sqlite.prepare("SELECT count(*) AS n FROM tastings WHERE name='New tasting'").get()).toMatchObject({n:0});
  });
  it.each([false,true])('rolls back failed creation, cleans uploaded objects, and allows a safe retry (multipart=%s)',async multipart=>{
    const {sqlite,bucket,request}=setup();
    sqlite.exec("CREATE TRIGGER reject_structure BEFORE INSERT ON wine_tasting_structures BEGIN SELECT RAISE(ABORT,'Simulated structure failure'); END");
    function body(){
      if(!multipart)return rich;
      const form=new FormData();form.set('wine',JSON.stringify(rich));form.append('images',new File([new Uint8Array(2048)],'bottle.jpg',{type:'image/jpeg'}));
      form.set('dimensions',JSON.stringify([{width:1200,height:1600}]));form.set('metadata',JSON.stringify([{source:'none'}]));return form;
    }
    expect((await request('POST','/api/wines',body(),multipart)).status).toBe(500);
    for(const table of ['wines','wine_experiences','wine_tasting_structures','tastings','wine_images'])expect(sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toMatchObject({n:0});
    expect(bucket.delete).toHaveBeenCalledTimes(multipart?1:0);
    sqlite.exec('DROP TRIGGER reject_structure');
    expect((await request('POST','/api/wines',body(),multipart)).status).toBe(201);
    expect(sqlite.prepare('SELECT count(*) AS n FROM wines').get()).toMatchObject({n:1});
  });
  it('rejects invalid structure before writing anything',async()=>{
    const {sqlite,request}=setup();
    expect((await request('POST','/api/wines',{...rich,tastingStructure:{acidity:'invalid'}})).status).toBe(400);
    expect(sqlite.prepare('SELECT count(*) AS n FROM wines').get()).toMatchObject({n:0});
  });
  it('does not update another owner or create a tasting for a missing wine',async()=>{
    const {sqlite,create,request}=setup(),id=await create();
    expect((await request('PUT',`/api/wines/${id}`,{...rich,tastingName:'Foreign'},false,'someone-else')).status).toBe(404);
    expect(sqlite.prepare("SELECT count(*) AS n FROM tastings WHERE name='Foreign'").get()).toMatchObject({n:0});
    expect(await (await request('GET',`/api/wines/${id}`)).json()).toMatchObject({rating:92});
  });
});
