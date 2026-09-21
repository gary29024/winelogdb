import { afterEach,describe,expect,it,vi } from 'vitest';
import { parseLwinReference,type LwinReferenceProduct } from '../../src/lib/wine/lwinImport';
import { lwinCandidateRowsForProducer,lwinRowById,lwinReferenceIdentity,producerLookupKeys,referenceShardId,type LwinProducerIndex } from '../../src/lib/wine/referenceCatalog';
import { resolveWineReference } from '../../src/lib/wine/referenceIdentity';
import { aiRepair,repairCandidates } from '../../worker/multiUser/lwinRepair';
import { linkWineReference,previewWineReference } from '../../worker/manualWineReference';
import * as transport from '../../worker/geminiTransport';
import { realD1 } from './support/realD1';

const moutonne=parseLwinReference({LWIN:'1060564',STATUS:'Live',DISPLAY_NAME:'Domaine Albert Bichot (Long-Depaquit), Chablis Grand Cru, Moutonne',PRODUCER_TITLE:'Domaine',PRODUCER_NAME:'Albert Bichot (Long-Depaquit)',WINE:'Moutonne',COUNTRY:'France',REGION:'Burgundy',SUB_REGION:'Chablis',CLASSIFICATION:'Grand Cru',COLOUR:'White',TYPE:'Wine',SUB_TYPE:'Still',VINTAGE_CONFIG:'sequential'});
const input={producer:'Albert Bichot',wineName:'Moutonne',vintage:2020,country:'France',region:'Burgundy',wineStyle:'white'};
const repairWine={...input,id:'w1',owner_id:'owner',wine_name:input.wineName,wine_style:input.wineStyle,release_designation:null};

// Model the existing import: full producer keys survive, common tokens do not.
function catalogue(rows=[moutonne],indexed=false){
 const index:LwinProducerIndex={},reads:string[]=[],objects:Record<string,unknown>={
  'reference/lwin/current.json':{provider:'lwin',version:'estate',prefix:'estate',shardCount:256,producerIndexKey:'estate/producers.json',...(indexed?{lwinIdIndexPrefix:'estate/id-'}:{})},
  'estate/producers.json':index
 };
 for(const row of rows){
  const shard=referenceShardId(row.producerKey),path=`estate/shard-${shard}.json`;
  ((objects[path]??=[]) as LwinReferenceProduct[]).push(row);
  const identity=lwinReferenceIdentity(row);
  for(const key of new Set([...producerLookupKeys(row.producerName),...producerLookupKeys(identity.producerName)])){
   const ids=index[key]??=[];if(!ids.includes(shard))ids.push(shard);
  }
  ((objects[`estate/id-${referenceShardId(row.lwin7)}.json`]??={}) as Record<string,string>)[row.lwin7]=shard;
 }
 const bucket={get:async(key:string)=>{reads.push(key);return key in objects?{text:async()=>JSON.stringify(objects[key])}:null}} as unknown as R2Bucket;
 return {bucket,objects,index,reads};
}
const databases:Array<ReturnType<typeof realD1>>=[];
afterEach(()=>{vi.restoreAllMocks();for(const database of databases.splice(0))database.close()});

describe('estate-qualified LWIN producer matching',()=>{
 it('finds Moutonne by code and saved short producer with the legacy index',async()=>{
  const {bucket,reads}=catalogue();
  expect(await lwinRowById(bucket,'1060564','Albert Bichot')).toMatchObject({lwin7:'1060564'});
  expect(reads.filter(key=>key.includes('/shard-'))).toHaveLength(1);
 });
 it('continues to find exact codes independently of producer with an ID index',async()=>{
  const {bucket,reads}=catalogue([moutonne],true);
  expect(await lwinRowById(bucket,'1060564','Unrelated producer')).toMatchObject({lwin7:'1060564'});
  expect(reads).not.toContain('estate/producers.json');
 });
 it('matches saved details and retrieves the AI candidate even when both token aliases are absent',async()=>{
  const {bucket}=catalogue();
  expect(await resolveWineReference(bucket,input)).toMatchObject({identityMatchStatus:'matched',lwin7:'1060564',lwin11:'10605642020'});
  expect((await repairCandidates(bucket,repairWine)).map(candidate=>candidate.row.lwin7)).toEqual(['1060564']);
 });
 it('shows a read-only preview and links the selected code without rewriting the saved names',async()=>{
  const database=realD1();databases.push(database);
  database.sql.exec("INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,wine_style,tasting_notes,created_at,updated_at) VALUES('w1','owner','Albert Bichot','Moutonne',2020,'France','Burgundy','white','Keep notes','now','now')");
  const env={DB:database.db,REFERENCE_DATA:catalogue().bucket};
  const read=()=>database.sql.prepare("SELECT * FROM wines WHERE id='w1'").get();
  const before=read(),{preview}=await previewWineReference(env,'owner','w1','1060564');
  expect(preview).toMatchObject({lwin7:'1060564',producer:'Domaine Albert Bichot (Long-Depaquit)',wineName:'Moutonne',colour:'White'});
  expect(read()).toEqual(before);
  await linkWineReference(env,'owner','w1',{lwin7:'1060564',previewToken:preview.previewToken});
  expect(read()).toMatchObject({lwin7:'1060564',identity_match_status:'manual',producer:'Albert Bichot',wine_name:'Moutonne',tasting_notes:'Keep notes'});
 });
 it.each(['Maison Albert Bichot (Other Estate)','Domaine Albert Bichot (Other Estate)','Maison Albert Bichot'])('retains ambiguity when %s also has the same wine',async producer=>{
  const other={...moutonne,lwin7:'1060565',productKey:'lwin:1060565',producerTitle:null,producerName:producer,producerKey:producer.toLowerCase(),displayName:`${producer}, Moutonne`};
  const {bucket}=catalogue([moutonne,other]);
  expect(await resolveWineReference(bucket,input)).toMatchObject({identityMatchStatus:'ambiguous',lwin7:null});
  const candidates=await repairCandidates(bucket,repairWine);
  expect(candidates).toEqual([]);
  const post=vi.spyOn(transport,'postGeminiGenerateContent');
  expect(await aiRepair({REFERENCE_DATA:bucket} as never,repairWine,candidates)).toBeNull();expect(post).not.toHaveBeenCalled();
 });
 it.each([
  {producer:'Maison Albert Bichot'},
  {producer:'Albert Bichot (Other Estate)'},
  {producer:'Albert'},
  {wineName:'Another cuvee'},
  {wineStyle:'red'},
  {region:'Bordeaux'},
  {appellation:'Meursault'}
 ])('does not match conflicting or insufficient clues: %j',async changes=>{
  expect(await resolveWineReference(catalogue().bucket,{...input,...changes})).toMatchObject({identityMatchStatus:'unmatched',lwin7:null});
 });
 it('does not infer an estate alias from an arbitrary suffix without parentheses',async()=>{
  const product={...moutonne,producerName:'Albert Bichot Other Company',displayName:'Domaine Albert Bichot Other Company, Moutonne'};
  expect(await resolveWineReference(catalogue([product]).bucket,input)).toMatchObject({identityMatchStatus:'unmatched'});
 });
 it('rejects excessive fan-out before reading any product shards instead of truncating ambiguity',async()=>{
  const {bucket,index,reads}=catalogue();
  index['albert bichot many estates']=Array.from({length:17},(_,i)=>String(i).padStart(3,'0'));
  await expect(resolveWineReference(bucket,input)).rejects.toThrow('too broad');
  await expect(lwinCandidateRowsForProducer(bucket,input.producer)).rejects.toThrow('too broad');
  expect(reads.filter(key=>key.includes('/shard-'))).toEqual([]);
 });
 it('fails a missing indexed shard rather than accepting a potentially incomplete shortlist',async()=>{
  const {bucket,index}=catalogue();index['albert bichot other estate']=['999'];
  await expect(repairCandidates(bucket,repairWine)).rejects.toThrow('shard unavailable');
 });
});
