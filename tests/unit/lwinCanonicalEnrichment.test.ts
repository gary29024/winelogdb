import { afterEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { parseLwinReference,type LwinReferenceProduct } from '../../src/lib/wine/lwinImport';
import { lwinReferenceIdentity,producerLookupKeys,referenceShardId } from '../../src/lib/wine/referenceCatalog';
import { enrichRecognitionReference,normalizeLwinId,referenceIdentityStatements,referenceMatchForProduct,resolveWineReference,type StoredReferenceIdentity } from '../../src/lib/wine/referenceIdentity';
import { enrichLwinTaxonomy,lwinResearchContext,parseLwinCode,readLwinReference } from '../../src/lib/wine/lwinMetadata';
import { lwinEnrichmentStatement,lwinInput,resolveStoredLwin,type StoredLwinWine } from '../../worker/lwinEnrichment';
import { processRolloutJob,recoverRollouts,rolloutRoute,rolloutStatus,type RolloutQueueJob } from '../../worker/multiUser/rollout';
import { attachLwinRange,producerLwinContext } from '../../src/lib/producers/lwinRange';
import { catalogHierarchyLabel,catalogVillageLabel } from '../../src/lib/cuvees/catalogPresentation';
import { aiRepair,deterministicRepair,repairCandidates } from '../../worker/multiUser/lwinRepair';
import * as transport from '../../worker/geminiTransport';
import { sharedWine } from '../../worker/multiUser/social';

const product=(overrides:Partial<LwinReferenceProduct>={}):LwinReferenceProduct=>({...parseLwinReference({LWIN:'1000001',STATUS:'Live',DISPLAY_NAME:'Domaine Example, Gevrey-Chambertin, Les Cazetiers',PRODUCER_TITLE:'Domaine',PRODUCER_NAME:'Example',WINE:'Les Cazetiers',COUNTRY:'France',REGION:'Burgundy',SUB_REGION:'Gevrey-Chambertin',SITE:'Les Cazetiers',PARCEL:'Dessus',COLOUR:'Red',TYPE:'Wine',SUB_TYPE:'Still',DESIGNATION:'AOP',CLASSIFICATION:'Premier Cru',VINTAGE_CONFIG:'sequential',FIRST_VINTAGE:2000,FINAL_VINTAGE:2025},'2026-09-20'),...overrides});
function bucket(rows:LwinReferenceProduct[]){
 const index:Record<string,string[]>={},objects:Record<string,unknown>={'reference/lwin/current.json':{provider:'lwin',version:'v1',prefix:'v1',shardCount:256,producerIndexKey:'v1/producers.json'},'v1/producers.json':index};
 for(const row of rows){const shard=referenceShardId(row.producerKey),path=`v1/shard-${shard}.json`;objects[path]=[...(objects[path] as LwinReferenceProduct[]??[]),row];for(const key of producerLookupKeys(lwinReferenceIdentity(row).producerName))index[key]=[shard]}
 const get=vi.fn(async(key:string)=>key in objects?{text:async()=>JSON.stringify(objects[key])}:null);
 return {bucket:{get} as unknown as R2Bucket,get,objects};
}
const databases:Array<ReturnType<typeof realD1>>=[];
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();for(const db of databases.splice(0))db.close()});
function setup(rows=[product()]){
 const database=realD1();databases.push(database);const catalog=bucket(rows),sent:RolloutQueueJob[]=[];
 const env={DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',REFERENCE_DATA:catalog.bucket,WINE_IMAGES:catalog.bucket,RESEARCH_QUEUE:{send:vi.fn(async(job:RolloutQueueJob)=>{sent.push(job)})} as unknown as Queue<unknown>};
 const add=(id='w1',owner='owner')=>database.sql.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,vintage,tasting_notes,rating,created_at,updated_at) VALUES(?,?,'Domaine Example','Les Cazetiers',2020,'private note',95,'now','now')").run(id,owner);
 const row=(id='w1')=>database.sql.prepare('SELECT * FROM wines WHERE id=?').get(id) as StoredLwinWine;
 const start=(refresh=false,kind='lwin')=>rolloutRoute(new Request(`https://wine.example/api/admin/rollout/${kind}`,{method:'POST',body:JSON.stringify({refresh})}),env,{id:'owner',email:'owner@example.com',display_name:'Owner',role:'owner',status:'active'});
 return {database,env,catalog,sent,add,row,start};
}

describe('canonical LWIN matching',()=>{
 it('uses full display identity and structured site/parcel/type/colour/vintage clues',async()=>{
  const rows=[product(),product({lwin7:'1000002',productKey:'lwin:1000002',parcel:'Dessous'}),product({lwin7:'1000003',productKey:'lwin:1000003',colour:'White',colourKey:'white'})],b=bucket(rows).bucket;
  expect((await resolveWineReference(b,{producer:'Domaine Example',wineName:'Les Cazetiers'})).identityMatchStatus).toBe('ambiguous');
  const match=await resolveWineReference(b,{producer:'Domaine Example',wineName:'Gevrey-Chambertin Les Cazetiers',colour:'Red',parcel:'Dessus',vintage:2020});
  expect(match).toMatchObject({lwin7:'1000001',lwin11:'10000012020',lwinReference:{subRegion:'Gevrey-Chambertin',site:'Les Cazetiers',parcel:'Dessus',designation:'AOP',classification:'Premier Cru'}});
  expect((await resolveWineReference(b,{producer:'Domaine Example',wineName:'Les Cazetiers',wineStyle:'sparkling'})).lwin7).toBeNull();
  expect((await resolveWineReference(b,{producer:'Domaine Example',wineName:'Les Cazetiers',vintage:1990})).lwin7).toBeNull();
 });
 it('does not cross a domaine/maison boundary even with a shared structured producer name',async()=>{
  const b=bucket([product({producerTitle:'Maison',displayName:'Maison Example, Les Cazetiers'})]).bucket;
  expect((await resolveWineReference(b,{producer:'Domaine Example',wineName:'Les Cazetiers'})).lwin7).toBeNull();
 });
 it('never turns a near name into a deterministic match based on score alone',()=>{
  expect(deterministicRepair([{row:product(),score:.99}])).toBeNull();
 });
 it('filters contradictory AI candidates and uses a selected product directly when names remain ambiguous',async()=>{
  const {env,database}=setup();
  const wine={id:'w1',owner_id:'owner',producer:'Domaine Example',wine_name:'Cazetiers',country:'France',region:'Burgundy',wine_style:'red',release_designation:null};
  const other=product({colour:'White',colourKey:'white'});
  expect(await repairCandidates(bucket([other]).bucket,wine)).toEqual([]);
  const post=vi.spyOn(transport,'postGeminiGenerateContent').mockResolvedValue({response:Response.json({candidates:[{content:{parts:[{text:JSON.stringify({lwin7:'1000001',confidence:.95})}]}}]}),provider:'vertex-ai-gateway'});
  expect(await aiRepair(env,wine,[{row:product(),score:.8}])).toMatchObject({lwin7:'1000001',method:'ai'});
  expect(post).toHaveBeenCalledTimes(1);
  expect(database.sql.prepare('SELECT count(*) AS n FROM ai_usage_events').get()?.n).toBe(1);
 });
 it('keeps LWIN7/11/16/18 precision separate and rejects numeric precision loss',async()=>{
  expect(parseLwinCode('1012361')).toMatchObject({precision:7,vintageCode:null,bottleSizeMl:null,packSize:null});
  expect(parseLwinCode('10123612009')).toMatchObject({precision:11,vintageCode:'2009',bottleSizeMl:null});
  expect(parseLwinCode('1012361200900750')).toMatchObject({precision:16,vintageCode:'2009',bottleSizeMl:750,packSize:null});
  expect(parseLwinCode('101236120091200750')).toMatchObject({precision:18,vintageCode:'2009',bottleSizeMl:750,packSize:12});
  expect(parseLwinCode(Number('101236120091200750'))).toBeNull();
  expect(normalizeLwinId('101236120091200750')).toBeNull();
  const b=bucket([product()]).bucket;
  expect((await referenceMatchForProduct(b,product({vintageConfig:'nonSequential'}),{vintage:2020})).lwin11).toBeNull();
  expect((await referenceMatchForProduct(b,product(),{vintageKind:'non_vintage'})).lwin11).toBeNull();
 });
});

describe('safe reference enrichment',()=>{
 it.each(['matched','manual'] as const)('backfills an ELID imported after an accepted %s LWIN snapshot',async status=>{
  const {env,add,row,catalog,database}=setup();add();
  const initial=await resolveStoredLwin(env.REFERENCE_DATA,row());
  await lwinEnrichmentStatement(env.DB,row(),initial!)!.run();
  database.sql.prepare('UPDATE wines SET identity_match_status=?').run(status);
  const before=row();expect(before.elid).toBeNull();
  const elid='FR-BGN-EXAM01-2020';
  catalog.objects['reference/elid/current.json']={provider:'elid',version:'e1',prefix:'elid/e1',shardCount:256,producerIndexKey:'elid/e1/producers.json'};
  catalog.objects['elid/e1/producers.json']={'domaine example':['FR-EXAM'],example:['FR-EXAM']};
  catalog.objects[`elid/e1/shard-${referenceShardId('FR-EXAM')}.json`]=[{elid,baseElid:'FR-BGN-EXAM01',producerCode:'FR-EXAM',wineKey:'les cazetiers',vintageCode:'2020'}];
  // A new request after the absent-manifest cache expires sees the import.
  vi.useFakeTimers();vi.advanceTimersByTime(61_000);
  const match=await resolveStoredLwin(env.REFERENCE_DATA,row());
  expect(match?.elid).toBe(elid);
  await lwinEnrichmentStatement(env.DB,row(),match!,status==='manual'?'manual':'deterministic')!.run();
  expect(row()).toMatchObject({elid,identity_match_status:status,lwin7:before.lwin7,producer:before.producer,wine_name:before.wine_name,tasting_notes:before.tasting_notes,rating:before.rating});
  const reads=catalog.get.mock.calls.length;
  expect(lwinEnrichmentStatement(env.DB,row(),(await resolveStoredLwin(env.REFERENCE_DATA,row()))!,status==='manual'?'manual':'deterministic')).toBeNull();
  expect(catalog.get.mock.calls.length).toBe(reads);
 });
 it('keeps accepted ELIDs across an LWIN catalogue version refresh without needing ELID availability',async()=>{
  const {env,add,row,catalog,database}=setup();add();
  await lwinEnrichmentStatement(env.DB,row(),(await resolveStoredLwin(env.REFERENCE_DATA,row()))!)!.run();
  const reference=readLwinReference(row().lwin_reference_json)!;
  database.sql.prepare('UPDATE wines SET elid=?,lwin_reference_json=?').run('FR-BGN-EXAM01-2020',JSON.stringify({...reference,version:'older'}));
  catalog.get.mockClear();
  const match=await resolveStoredLwin(env.REFERENCE_DATA,row());
  expect(match?.elid).toBe('FR-BGN-EXAM01-2020');
  expect(catalog.get.mock.calls.some(([key])=>key.startsWith('reference/elid/'))).toBe(false);
 });
 it('does not backfill an explicitly rejected reference',async()=>{
  const {env,add,row,database}=setup();add();database.sql.exec("UPDATE wines SET identity_match_status='manual'");
  expect(await resolveStoredLwin(env.REFERENCE_DATA,row())).toBeNull();
  expect(row().elid).toBeNull();
 });
 it('fills blanks, preserves names and conflicts, and makes a second pass a no-op',async()=>{
  const {env,add,row,catalog,database}=setup();add();
  database.sql.exec("UPDATE wines SET country='  ',colour='White',classification_override='none',identity_match_status='manual',lwin7='1000001'");
  const match=await resolveStoredLwin(env.REFERENCE_DATA,row());expect(match).not.toBeNull();
  await lwinEnrichmentStatement(env.DB,row(),match!,'manual')!.run();
  expect(row()).toMatchObject({producer:'Domaine Example',wine_name:'Les Cazetiers',country:'France',region:'Burgundy',colour:'White',classification:null,tasting_notes:'private note',rating:95});
  const reference=readLwinReference(row().lwin_reference_json)!;
  expect(reference.filled).toMatchObject({country:'France',region:'Burgundy',productType:'Wine'});
  expect(reference.conflicts).toEqual(expect.arrayContaining([{field:'colour',current:'White',reference:'Red'},{field:'classification',current:'none',reference:'premier_cru'}]));
  const reads=catalog.get.mock.calls.length,writes=database.counts().writes;
  const again=await resolveStoredLwin(env.REFERENCE_DATA,row());
  expect(lwinEnrichmentStatement(env.DB,row(),again!,'manual')).toBeNull();
  expect(catalog.get.mock.calls.length).toBe(reads);expect(database.counts().writes).toBe(writes);
 });
 it('records edited fields as conflicts instead of continuing to attribute them to LWIN',async()=>{
  const reference=(await referenceMatchForProduct(bucket([product()]).bucket,product(),{})).lwinReference!;
  const first=enrichLwinTaxonomy({country:null},reference);
  const second=enrichLwinTaxonomy({...first,country:'Italy'},first.lwinReference);
  expect(second.country).toBe('Italy');expect(second.lwinReference.filled.country).toBeUndefined();
  expect(second.lwinReference.conflicts).toContainEqual({field:'country',current:'Italy',reference:'France'});
 });
 it('uses the same enrichment for recognition and stored wines without trusting client IDs',async()=>{
  const {env,add,row}=setup();add();const input=lwinInput(row());
  const scan=await enrichRecognitionReference(env.REFERENCE_DATA,input),saved=await resolveStoredLwin(env.REFERENCE_DATA,row());
  await lwinEnrichmentStatement(env.DB,row(),saved!)!.run();
  expect(row().country).toBe(scan.country);expect(readLwinReference(row().lwin_reference_json)?.site).toBe(('lwinReference' in scan?readLwinReference(scan.lwinReference)?.site:null));
 });
 it('guards owner and identity fields against a concurrent edit',async()=>{
  const {env,add,row,database}=setup();add();const original=row(),match=await resolveStoredLwin(env.REFERENCE_DATA,original);
  database.sql.exec("UPDATE wines SET wine_name='User correction'");
  expect((await lwinEnrichmentStatement(env.DB,original,match!)!.run()).meta.changes).toBe(0);
  expect(row().lwin7).toBeNull();
  expect((await lwinEnrichmentStatement(env.DB,{...row(),owner_id:'other'},match!)!.run()).meta.changes).toBe(0);
 });
 it('shares reference taxonomy without exposing fill provenance or conflicts',async()=>{
  const {env,add,row}=setup();add();const match=await resolveStoredLwin(env.REFERENCE_DATA,row());await lwinEnrichmentStatement(env.DB,row(),match!)!.run();
  const shared=sharedWine({...row(),viewer_tasting_notes:'my own note',viewer_rating:88});
  expect(shared).toMatchObject({tastingNotes:'my own note',rating:88,lwinReference:{source:'lwin',site:'Les Cazetiers'}});
  expect(shared.lwinReference).not.toHaveProperty('filled');expect(shared.lwinReference).not.toHaveProperty('conflicts');expect(shared.lwinReference).not.toHaveProperty('input');
  expect(JSON.stringify(shared)).not.toContain('private note');
 });
 it('clears vintage precision when an explicitly linked wine changes to an unprovable vintage',async()=>{
  const {env,add,row,database}=setup();add();const match=await resolveStoredLwin(env.REFERENCE_DATA,row());await lwinEnrichmentStatement(env.DB,row(),match!)!.run();
  database.sql.exec("UPDATE wines SET identity_match_status='manual',elid='FR-BGN-EXAMPL-2020'");
  const previous=row();
  await env.DB.batch(referenceIdentityStatements(env.DB,'owner','w1',{producer:previous.producer,wineName:previous.wine_name,vintage:1990},'now',true,{producer:previous.producer,wine_name:previous.wine_name,lwin7:'1000001',identity_match_status:'manual',lwin_reference_json:String(previous.lwin_reference_json),vintage:2020}));
  expect(row()).toMatchObject({identity_match_status:'manual',lwin7:'1000001',lwin11:null,elid:null});
 });
 it('keeps research to accepted references and groups non-Burgundy classifications by their actual label',async()=>{
  const reference=(await referenceMatchForProduct(bucket([product()]).bucket,product(),{})).lwinReference!;
  const row={lwin7:reference.lwin7,identity_match_status:'matched',lwin_reference_json:reference};
  expect(lwinResearchContext(row)).toContain('Les Cazetiers');expect(lwinResearchContext({...row,identity_match_status:'conflict'})).toBe('');
  expect(producerLwinContext([reference])).toContain('not the complete or current producer range');
  const range=attachLwinRange([{name:'Les Cazetiers',category:'red'}],[reference],['Domaine Example']);
  expect(catalogVillageLabel(range[0])).toBe('Gevrey-Chambertin');expect(catalogHierarchyLabel(range[0])).toBe('Premier Cru / 1er Cru');
  expect(catalogHierarchyLabel({name:'Example',lwinReference:{...reference,region:'Tuscany',classification:null,designation:'DOCG'}})).toBe('DOCG');
  expect(catalogHierarchyLabel({name:'Example',lwinReference:{...reference,region:'Bordeaux',classification:'Premier Grand Cru Classe A'}})).toBe('Premier Grand Cru Classe A');
  expect(attachLwinRange([{name:'Les Cazetiers'}],[reference],['Maison Example'])[0].lwinReference).toBeUndefined();
  expect(attachLwinRange([{name:'Les Cazetiers',classification:'Village'}],[reference],['Domaine Example'])[0].lwinReference).toBeUndefined();
 });
});

describe('durable LWIN backfill',()=>{
 it('runs deterministic resolution before AI and enriches successful AI selections identically',async()=>{
  const {start,add,env,database,row}=setup();add('w1');add('w2');
  database.sql.exec("UPDATE wines SET wine_name='Cazetiers' WHERE id='w2'");
  const post=vi.spyOn(transport,'postGeminiGenerateContent').mockResolvedValue({response:Response.json({candidates:[{content:{parts:[{text:JSON.stringify({lwin7:'1000001',confidence:.95})}]}}]}),provider:'vertex-ai-gateway'});
  await start(false,'lwin-ai');await processRolloutJob(env,'lwin_ai');expect(post).not.toHaveBeenCalled();
  await processRolloutJob(env,'lwin_ai');expect(post).toHaveBeenCalledTimes(1);
  expect(row('w2')).toMatchObject({wine_name:'Cazetiers',country:'France',region:'Burgundy',lwin7:'1000001',colour:'Red'});
  expect(readLwinReference(row('w2').lwin_reference_json)).toMatchObject({method:'ai',confidence:.95});
  await processRolloutJob(env,'lwin_ai');expect(post).toHaveBeenCalledTimes(1);
  expect((await rolloutStatus(env.DB)).lwinAi).toMatchObject({state:'complete',processed:2,deterministic:1,ai:1});
  const before=row('w2');
  await env.DB.batch(referenceIdentityStatements(env.DB,'owner','w2',{...lwinInput(before),producer:before.producer,wineName:before.wine_name,identityMatchStatus:'unmatched'},'now',true,before as StoredReferenceIdentity));
  expect(row('w2').identity_match_status).toBe('matched');
  await start(false,'lwin-validate');await processRolloutJob(env,'lwin_validate');
  expect(row('w2').identity_match_status).toBe('matched');expect(post).toHaveBeenCalledTimes(1);
 });
 it('keeps exact ambiguity for review without buying an AI guess',async()=>{
  const {start,add,env,row}=setup([product(),product({lwin7:'1000002',productKey:'lwin:1000002',parcel:'Dessous'})]);add();
  const post=vi.spyOn(transport,'postGeminiGenerateContent');
  await start(false,'lwin-ai');await processRolloutJob(env,'lwin_ai');
  expect(row()).toMatchObject({lwin7:null,identity_match_status:'ambiguous'});expect(post).not.toHaveBeenCalled();
 });
 it('serializes concurrent starts and deduplicates recovery dispatches',async()=>{
  const {start,add,sent,env,database}=setup();add();
  await Promise.all([start(),start()]);expect(sent).toHaveLength(1);
  await recoverRollouts(env);await recoverRollouts(env);expect(sent).toHaveLength(1);
  expect(database.sql.prepare('SELECT count(*) AS n FROM queue_outbox').get()?.n).toBe(1);
  await processRolloutJob(env,'lwin',sent[0]);
  expect((await rolloutStatus(env.DB)).lwin).toMatchObject({processed:1,matched:1,state:'complete'});
 });
 it('preserves a successful per-wine checkpoint after a later failure and resumes without recounting',async()=>{
  const {start,add,env,database,row}=setup();add('w1');add('w2');
  await start();
  database.sql.exec("CREATE TRIGGER fail_second BEFORE UPDATE ON wines WHEN OLD.id='w2' BEGIN SELECT RAISE(ABORT,'interrupted'); END");
  await expect(processRolloutJob(env,'lwin')).rejects.toThrow('interrupted');
  expect(row('w1').lwin7).toBe('1000001');expect(row('w2').lwin7).toBeNull();
  expect((await rolloutStatus(env.DB)).lwin).toMatchObject({processed:1,matched:1,state:'paused'});
  database.sql.exec('DROP TRIGGER fail_second');await start();await processRolloutJob(env,'lwin');
  expect((await rolloutStatus(env.DB)).lwin).toMatchObject({processed:2,matched:2,state:'complete'});
 });
 it('rolls back wine writes when saving the checkpoint fails',async()=>{
  const {start,add,env,database,row}=setup();add();await start();
  database.sql.exec("CREATE TRIGGER fail_checkpoint BEFORE UPDATE ON rollout_state WHEN OLD.name='lwin_cursor' BEGIN SELECT RAISE(ABORT,'checkpoint interrupted'); END");
  await expect(processRolloutJob(env,'lwin')).rejects.toThrow('checkpoint interrupted');
  expect(row().lwin7).toBeNull();expect((await rolloutStatus(env.DB)).lwin.processed).toBe(0);
  database.sql.exec('DROP TRIGGER fail_checkpoint');await start();await processRolloutJob(env,'lwin');expect(row().lwin7).toBe('1000001');
 });
 it('ignores old-generation deliveries after refresh and enriches already matched wines',async()=>{
  const {start,add,env,database,row,sent}=setup();add();
  database.sql.exec("UPDATE wines SET lwin7='1000001',identity_match_status='matched'");
  await start();const old=sent[0];await processRolloutJob(env,'lwin',old);expect(row().country).toBe('France');
  const before=row();await start(true);expect(await processRolloutJob(env,'lwin',old)).toMatchObject({stale:true,processed:0});
  await processRolloutJob(env,'lwin',sent.at(-1));expect(row()).toEqual(before);
 });
 it('keeps catalogue outages retryable instead of recording a permanent no-match',async()=>{
  const {start,add,env,catalog,row}=setup();add();delete catalog.objects['reference/lwin/current.json'];await start();
  await expect(processRolloutJob(env,'lwin')).rejects.toThrow('catalogue unavailable');
  expect(row().identity_match_status).toBeNull();expect((await rolloutStatus(env.DB)).lwin).toMatchObject({state:'paused',processed:0});
 });
 it('recovers a failed queue send with the same durable job ID',async()=>{
  vi.useFakeTimers();const {start,add,env,database,sent}=setup();add();
  vi.mocked(env.RESEARCH_QUEUE.send).mockRejectedValueOnce(new Error('queue offline'));
  await start();expect((await rolloutStatus(env.DB)).lwin.state).toBe('running');
  const initial=database.sql.prepare('SELECT id FROM queue_outbox').get()!.id;
  vi.setSystemTime(Date.now()+61_000);await recoverRollouts(env);
  expect(sent).toHaveLength(1);expect(sent[0]._outboxId).toBe(initial);
  expect(database.sql.prepare('SELECT count(*) AS n FROM queue_outbox').get()?.n).toBe(1);
 });
 it('does not commit or advance after the wine changes during reference I/O',async()=>{
  const {start,add,env,database,catalog,row}=setup();add();await start();
  const original=catalog.get.getMockImplementation()!;
  catalog.get.mockImplementation(async key=>{if(key.includes('shard-'))database.sql.exec("UPDATE wines SET wine_name='User correction'");return original(key)});
  await expect(processRolloutJob(env,'lwin')).rejects.toThrow('changed or its LWIN processing lease expired');
  expect(row()).toMatchObject({wine_name:'User correction',lwin7:null});expect((await rolloutStatus(env.DB)).lwin.processed).toBe(0);
 });
});
