import { afterEach,describe,expect,it,vi } from 'vitest';
import app from '../../worker/structureEntry';
import { createSession } from '../../src/lib/auth/session';
import { migratedSqliteD1 } from './support/sqliteD1';
import * as referenceIdentity from '../../src/lib/wine/referenceIdentity';
import { blank } from './support/wineSaveFixture';

const SECRET='test-secret-value-long-enough-for-hmac';
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
  it('keeps the save error contract when the ownership lookup fails',async()=>{
    const {db,create,request}=setup(),id=await create();
    const prepare=db.prepare.bind(db),error=new Error('D1 lookup unavailable');
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    vi.spyOn(db,'prepare').mockImplementation(sql=>{
      if(sql==='SELECT * FROM wines WHERE owner_id=? AND id=?')throw error;
      return prepare(sql);
    });
    const response=await request('PUT',`/api/wines/${id}`,blank);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error:'Could not save wine. Please retry.'});
    expect(log).toHaveBeenCalledWith('wine-save-failed',error);
  });

  it.each([false,true])('saves schema-valid omitted optional fields as SQL nulls (multipart=%s)',async multipart=>{
    const {sqlite,request}=setup(),minimal={producer:'Minimal estate',wineName:'Minimal bottle'};
    const form=new FormData();form.set('wine',JSON.stringify(minimal));
    form.append('images',new File([new Uint8Array(2048)],'bottle.jpg',{type:'image/jpeg'}));
    form.set('dimensions',JSON.stringify([{width:1200,height:1600}]));form.set('metadata',JSON.stringify([{source:'none'}]));
    const created=await request('POST','/api/wines',multipart?form:minimal,multipart);
    expect(created.status,await created.clone().text()).toBe(201);
    const {id}=await created.json() as {id:string};
    expect(sqlite.prepare('SELECT country,wine_style,rating,price FROM wines WHERE id=?').get(id)).toMatchObject({country:null,wine_style:null,rating:null,price:null});
    const updated=await request('PUT',`/api/wines/${id}`,{...minimal,wineName:'Corrected minimal bottle'});
    expect(updated.status,await updated.clone().text()).toBe(200);
    expect(sqlite.prepare('SELECT wine_name,country,rating FROM wines WHERE id=?').get(id)).toMatchObject({wine_name:'Corrected minimal bottle',country:null,rating:null});
  });

  it('rejects an unowned partial edit before enrichment or preparing update values',async()=>{
    const {sqlite,create,request}=setup(),id=await create();
    const enrich=vi.spyOn(referenceIdentity,'enrichRecognitionReference');
    const response=await request('PUT',`/api/wines/${id}`,{producer:'Intruder',wineName:'Changed'},false,'someone-else');
    expect(response.status).toBe(404);
    expect(enrich).not.toHaveBeenCalled();
    expect(sqlite.prepare('SELECT producer,wine_name,tasting_notes FROM wines WHERE id=?').get(id)).toMatchObject({producer:'Test estate',wine_name:'Test wine',tasting_notes:'Original note'});
    expect(sqlite.prepare("SELECT count(*) AS n FROM wine_experiences WHERE owner_id='someone-else'").get()).toMatchObject({n:0});
  });

  it.each([
    {change:{producer:'Correct estate'},lookup:'matched',stored:'matched',expected:'matched'},
    {change:{wineName:'Correct wine'},lookup:'matched',stored:'conflict',expected:'matched'},
    {change:{tastingNotes:'New note'},lookup:'matched',stored:'matched',expected:'conflict'},
    {change:{producer:' TEST ESTATE '},lookup:'matched',stored:'matched',expected:'conflict'},
    {change:{producer:'Correct estate'},lookup:'unmatched',stored:'matched',expected:'unmatched'},
    {change:{wineName:'Unknown wine'},lookup:'unmatched',stored:'conflict',expected:'unmatched'},
    {change:{tastingNotes:'New note'},lookup:'unmatched',stored:'matched',expected:'conflict'},
    {change:{producer:'Correct estate'},lookup:'unmatched',stored:'manual',expected:'manual'},
    {change:{producer:'Correct estate'},lookup:'ambiguous',stored:'matched',expected:'conflict'},
    {change:{producer:'Correct estate'},lookup:'matched',stored:'manual',expected:'manual'},
  ] as const)('handles a name correction without bypassing reference safeguards: %j',async({change,lookup,stored,expected})=>{
    const {sqlite,create,request}=setup(),id=await create(blank);
    sqlite.prepare("UPDATE wines SET lwin7='1000001',lwin11='10000012020',elid='FR-BDX-MARG01-2020',identity_match_status=?,reference_product_key='lwin:1000001',colour='Red',product_type='Wine',product_subtype='Still',reference_site='Old site',reference_parcel='Old parcel',identity_matched_at='old',reference_suggestions_json='[]' WHERE id=?").run(stored,id);
    vi.spyOn(referenceIdentity,'enrichRecognitionReference').mockImplementation(async (_bucket,wine)=>({...wine,identityMatchStatus:lookup,lwin7:lookup==='matched'?'1000009':null,lwin11:lookup==='matched'?'10000092020':null,elid:null,referenceProductKey:lookup==='matched'?'lwin:1000009':null,colour:'White',identityMatchCandidates:lookup==='ambiguous'?['1000009','1000010']:[]}));
    expect((await request('PUT',`/api/wines/${id}`,{...blank,...change})).status).toBe(200);
    const row=sqlite.prepare('SELECT * FROM wines WHERE id=?').get(id) as Record<string,unknown>;
    expect(row.identity_match_status).toBe(expected);
    expect(row).toMatchObject(expected==='matched'
      ?{lwin7:'1000009',lwin11:'10000092020',elid:null,reference_product_key:'lwin:1000009',colour:'Red',identity_match_candidates_json:null}
      :expected==='unmatched'?{lwin7:null,lwin11:null,elid:null,reference_product_key:null,colour:'Red',product_type:'Wine',product_subtype:'Still',reference_site:null,reference_parcel:null,identity_match_candidates_json:null,identity_matched_at:null,reference_suggestions_json:null}
      :{lwin7:'1000001',lwin11:'10000012020',elid:'FR-BDX-MARG01-2020',reference_product_key:'lwin:1000001',colour:'Red'});
    if(expected==='conflict'){
      const candidates=JSON.parse(String(row.identity_match_candidates_json));
      expect(candidates).toContain('1000001');
      if(lookup!=='unmatched')expect(candidates).toContain('1000009');
    }
  });
  it('preserves stored identity when a rename lookup fails to complete',async()=>{
    const {sqlite,create,request}=setup(),id=await create(blank);
    sqlite.prepare("UPDATE wines SET lwin7='1000001',elid='FR-BDX-MARG01-2020',identity_match_status='matched' WHERE id=?").run(id);
    // The unavailable reference bucket makes enrichment return without a status.
    expect((await request('PUT',`/api/wines/${id}`,{...blank,producer:'Unknown estate'})).status).toBe(200);
    expect(sqlite.prepare('SELECT lwin7,elid,identity_match_status FROM wines WHERE id=?').get(id)).toMatchObject({lwin7:'1000001',elid:'FR-BDX-MARG01-2020',identity_match_status:'matched'});
  });
  it('saves, preserves, replaces and clears release details with the wine',async()=>{
    const {create,request}=setup(),id=await create({...blank,sparklingDetails:{dosageGPerL:0,disgorgement:'Spring 2024'}});
    expect(await (await request('GET',`/api/wines/${id}`)).json()).toMatchObject({sparklingDetails:{dosageGPerL:0,disgorgement:'Spring 2024'}});
    await request('PUT',`/api/wines/${id}`,blank);
    expect(await (await request('GET',`/api/wines/${id}`)).json()).toMatchObject({sparklingDetails:{dosageGPerL:0}});
    await request('PUT',`/api/wines/${id}`,{...blank,sparklingDetails:{dosageGPerL:3}});
    expect(await (await request('GET',`/api/wines/${id}`)).json()).toMatchObject({sparklingDetails:{dosageGPerL:3}});
    for(const details of [null,{}]){
      await request('PUT',`/api/wines/${id}`,{...blank,sparklingDetails:details});
      expect(await (await request('GET',`/api/wines/${id}`)).json()).toMatchObject({sparklingDetails:null});
    }
  });
  it('rolls back creation and edits when release details fail',async()=>{
    const {sqlite,create,request}=setup(),id=await create();
    sqlite.exec("CREATE TRIGGER reject_sparkling BEFORE INSERT ON wine_sparkling_details BEGIN SELECT RAISE(ABORT,'Simulated release failure'); END");
    const changed={...rich,wineName:'Changed',tastingName:'New tasting',sparklingDetails:{dosageGPerL:4}};
    expect((await request('PUT',`/api/wines/${id}`,changed)).status).toBe(500);
    expect((await request('POST','/api/wines',changed)).status).toBe(500);
    expect(await (await request('GET',`/api/wines/${id}`)).json()).toMatchObject({wineName:'Test wine',tastingName:'Original tasting',sparklingDetails:null});
    expect(sqlite.prepare('SELECT count(*) AS n FROM wines').get()).toMatchObject({n:1});
    expect(sqlite.prepare("SELECT count(*) AS n FROM tastings WHERE name='New tasting'").get()).toMatchObject({n:0});
  });
  it('validates release details and prevents cross-owner changes',async()=>{
    const {sqlite,create,request}=setup(),id=await create({...blank,sparklingDetails:{dosageGPerL:2}});
    expect((await request('POST','/api/wines',{...blank,sparklingDetails:{dosageGPerL:-1}})).status).toBe(400);
    expect((await request('PUT',`/api/wines/${id}`,{...blank,sparklingDetails:null},false,'someone-else')).status).toBe(404);
    expect(await (await request('GET',`/api/wines/${id}`)).json()).toMatchObject({sparklingDetails:{dosageGPerL:2}});
    expect((await request('DELETE',`/api/wines/${id}`)).status).toBe(204);
    expect(sqlite.prepare('SELECT count(*) AS n FROM wine_sparkling_details').get()).toMatchObject({n:0});
  });
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
  it.each(['ended_at','last_wine_at'])('rolls creation back if live-tasting activity fails (%s)',async column=>{
    const {sqlite,request}=setup();
    const date=column==='ended_at'?'2026-08-31':'2026-09-01';
    sqlite.prepare("INSERT INTO tastings(id,owner_id,name,tasting_date,started_at,created_at,updated_at) VALUES('active','owner','Original tasting',?,'2026-08-31','2026-08-31','2026-08-31')").run(date);
    sqlite.exec(`CREATE TRIGGER reject_activity BEFORE UPDATE OF ${column} ON tastings WHEN OLD.id='active' BEGIN SELECT RAISE(ABORT,'Simulated activity failure'); END`);
    expect((await request('POST','/api/wines',rich)).status).toBe(500);
    for(const table of ['wines','wine_experiences','wine_tasting_structures'])expect(sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toMatchObject({n:0});
    expect(sqlite.prepare("SELECT ended_at,last_wine_at FROM tastings WHERE id='active'").get()).toMatchObject({ended_at:null,last_wine_at:null});
    expect(sqlite.prepare('SELECT count(*) AS n FROM tastings').get()).toMatchObject({n:1});
    sqlite.exec('DROP TRIGGER reject_activity');
    expect((await request('POST','/api/wines',rich)).status).toBe(201);
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
