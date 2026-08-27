import { linkWineProducer,normalizeProducerAlias,producerMatchKey } from './entities';
import { cleanupOrphanCuvee,cuveeIdentitySignature,linkWineCuvee,normalizeCuveeAlias } from '../cuvees/entities';

/**
 * Repairs identity keys written by the old ASCII-only normalizer.
 *
 * Every name with no Latin characters used to normalize to the empty string, and
 * producers.match_key is unique per owner - so the first producer written in
 * Chinese (or Cyrillic, or Greek) took the empty key and every later one
 * resolved to it. Two real domaines became one row, and the only surviving
 * record of the second name was the wine's own producer column.
 *
 * That column is what makes the repair possible: keys are recomputed, aliases
 * that only ever matched by collision are dropped, and every wine is re-linked
 * from the name it actually carries. A deliberate merge is not undone - its
 * alias survives the rebuild, so the wine still resolves to the producer it was
 * merged into.
 */
export type IdentityRepairReport={
  producersRekeyed:number;aliasesRekeyed:number;aliasesDropped:number;
  winesRelinked:number;cuveesRekeyed:number;cuveeAliasesRekeyed:number;capped:boolean;
};

/**
 * A ceiling on the writes one pass may do, so the repair cannot run a worker
 * out of subrequests on a large library. A capped pass is not recorded as
 * finished, so the next request continues where it left off.
 */
export const REPAIR_WRITE_BUDGET=300;

type ProducerRow={id:string;canonical_name:string;match_key:string};
type AliasRow={normalized_alias:string;producer_id:string;display_alias:string;created_at:string};
type WineRow={id:string;producer:string;producer_id:string|null;cuvee_id:string|null;country:string|null};
type CuveeRow={id:string;producer_id:string;canonical_name:string;signature_key:string;appellation:string|null;wine_style:string|null};
type CuveeAliasRow={producer_id:string;normalized_alias:string;appellation_key:string;cuvee_id:string;display_alias:string};

const rows=async<T>(db:D1Database,sql:string,...args:unknown[])=>((await db.prepare(sql).bind(...args).all<T>()).results??[]);

/**
 * Names a producer legitimately answers to beyond its own, from merges that
 * have not been undone. Without this the rebuild would drop the alias a merge
 * created and the merged producer's wines would spring back apart.
 */
async function mergedNames(db:D1Database,owner:string){
  const merges=await rows<{destination_producer_id:string;source_canonical_name:string;source_aliases_json:string}>(db,
    `SELECT destination_producer_id,source_canonical_name,source_aliases_json FROM producer_merges
     WHERE owner_id=? AND undone_at IS NULL`,owner);
  const byProducer=new Map<string,Set<string>>();
  for(const merge of merges){
    let aliases:unknown=[];try{aliases=JSON.parse(merge.source_aliases_json||'[]')}catch{aliases=[]}
    const names=[merge.source_canonical_name,...(Array.isArray(aliases)?aliases:[]).map(entry=>
      typeof entry==='string'?entry:String((entry as{display_alias?:unknown})?.display_alias??''))];
    const keys=byProducer.get(merge.destination_producer_id)??new Set<string>();
    for(const name of names)if(name.trim())keys.add(normalizeProducerAlias(name));
    byProducer.set(merge.destination_producer_id,keys);
  }
  return byProducer;
}

export async function repairIdentityKeys(db:D1Database,owner:string):Promise<IdentityRepairReport>{
  const report:IdentityRepairReport={producersRekeyed:0,aliasesRekeyed:0,aliasesDropped:0,winesRelinked:0,cuveesRekeyed:0,cuveeAliasesRekeyed:0,capped:false};
  let budget=REPAIR_WRITE_BUDGET;
  const spend=()=>{budget--;return budget>0};
  const now=new Date().toISOString();

  const producers=await rows<ProducerRow>(db,'SELECT id,canonical_name,match_key FROM producers WHERE owner_id=?',owner);
  const aliases=await rows<AliasRow>(db,'SELECT normalized_alias,producer_id,display_alias,created_at FROM producer_aliases WHERE owner_id=?',owner);
  const merged=await mergedNames(db,owner);

  // 1. Every producer keys on its own canonical name. The new key is strictly
  //    more discriminating than the old one, so two producers that were
  //    distinct before cannot collide now.
  const keyById=new Map<string,string>();
  for(const producer of producers){
    const next=producerMatchKey(producer.canonical_name);
    keyById.set(producer.id,next);
    if(next===producer.match_key)continue;
    try{
      await db.prepare('UPDATE producers SET match_key=?,updated_at=? WHERE owner_id=? AND id=?').bind(next,now,owner,producer.id).run();
      report.producersRekeyed++;
    }catch{keyById.set(producer.id,producer.match_key)}
    if(!spend()){report.capped=true;return report}
  }

  // 2. Rebuild the alias table. A row whose key no longer matches its own
  //    display name is stale; it is kept only if that name really belongs to
  //    the producer - its canonical name, or a name merged into it. Anything
  //    else was a collision, and dropping it is what lets the wines split.
  const aliasOwner=new Map<string,string>();
  for(const alias of aliases){
    const next=normalizeProducerAlias(alias.display_alias);
    if(next===alias.normalized_alias){aliasOwner.set(next,alias.producer_id);continue}
    await db.prepare('DELETE FROM producer_aliases WHERE owner_id=? AND normalized_alias=?').bind(owner,alias.normalized_alias).run();
    if(next!==keyById.get(alias.producer_id)&&!merged.get(alias.producer_id)?.has(next)){report.aliasesDropped++;continue}
    await db.prepare(`INSERT INTO producer_aliases(owner_id,normalized_alias,producer_id,display_alias,created_at) VALUES(?,?,?,?,?)
      ON CONFLICT(owner_id,normalized_alias) DO NOTHING`).bind(owner,next,alias.producer_id,alias.display_alias,alias.created_at||now).run();
    aliasOwner.set(next,alias.producer_id);
    report.aliasesRekeyed++;
    if(!spend()){report.capped=true;return report}
  }
  // A producer must always be findable under its own name, even if the only
  // alias row it had was the collided one.
  for(const producer of producers){
    const key=keyById.get(producer.id)!;
    if(aliasOwner.has(key))continue;
    await db.prepare(`INSERT INTO producer_aliases(owner_id,normalized_alias,producer_id,display_alias,created_at) VALUES(?,?,?,?,?)
      ON CONFLICT(owner_id,normalized_alias) DO NOTHING`).bind(owner,key,producer.id,producer.canonical_name,now).run();
    aliasOwner.set(key,producer.id);
    if(!spend()){report.capped=true;return report}
  }

  // 3. Cuvée keys carry the same fault one level down, and a wine about to move
  //    producer resolves its cuvée against them - so they are refreshed first.
  const namesByProducer=new Map<string,string[]>();
  for(const producer of producers)namesByProducer.set(producer.id,[producer.canonical_name]);
  for(const alias of aliases){
    const key=normalizeProducerAlias(alias.display_alias);
    // Only names the rebuild kept: a dropped collision must not go on stripping
    // its prefix off another producer's cuvées.
    if(aliasOwner.get(key)!==alias.producer_id)continue;
    const names=namesByProducer.get(alias.producer_id);
    if(names&&!names.includes(alias.display_alias))names.push(alias.display_alias);
  }
  const cuvees=await rows<CuveeRow>(db,'SELECT id,producer_id,canonical_name,signature_key,appellation,wine_style FROM cuvees WHERE owner_id=?',owner);
  for(const cuvee of cuvees){
    const next=cuveeIdentitySignature(cuvee.canonical_name,cuvee.appellation,cuvee.wine_style,namesByProducer.get(cuvee.producer_id)??[]);
    if(!next||next===cuvee.signature_key)continue;
    try{
      await db.prepare('UPDATE cuvees SET signature_key=?,updated_at=? WHERE owner_id=? AND id=?').bind(next,now,owner,cuvee.id).run();
      report.cuveesRekeyed++;
    }catch{/* another cuvée already holds that signature; reconciliation owns that case */}
    if(!spend()){report.capped=true;return report}
  }
  const cuveeAliases=await rows<CuveeAliasRow>(db,'SELECT producer_id,normalized_alias,appellation_key,cuvee_id,display_alias FROM cuvee_aliases WHERE owner_id=?',owner);
  for(const alias of cuveeAliases){
    const next=normalizeCuveeAlias(alias.display_alias);
    if(!next||next===alias.normalized_alias)continue;
    await db.prepare('DELETE FROM cuvee_aliases WHERE owner_id=? AND producer_id=? AND normalized_alias=? AND appellation_key=?')
      .bind(owner,alias.producer_id,alias.normalized_alias,alias.appellation_key).run();
    await db.prepare(`INSERT INTO cuvee_aliases(owner_id,producer_id,normalized_alias,appellation_key,cuvee_id,display_alias,created_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(owner_id,producer_id,normalized_alias,appellation_key) DO NOTHING`)
      .bind(owner,alias.producer_id,next,alias.appellation_key,alias.cuvee_id,alias.display_alias,now).run();
    report.cuveeAliasesRekeyed++;
    if(!spend()){report.capped=true;return report}
  }

  // 4. Re-link every wine from the name it carries. Resolution is done against
  //    the maps already in memory: a library of several hundred producers must
  //    not cost a query per wine.
  const matchOwner=new Map<string,string>();
  for(const producer of producers)matchOwner.set(keyById.get(producer.id)!,producer.id);
  const library=await rows<WineRow>(db,
    `SELECT id,producer,producer_id,cuvee_id,country FROM wines WHERE owner_id=? AND trim(coalesce(producer,''))<>''`,owner);
  for(const wine of library){
    const key=normalizeProducerAlias(wine.producer);
    const target=aliasOwner.get(key)??matchOwner.get(key)??null;
    if(target&&target===wine.producer_id)continue;
    const entity=await linkWineProducer(db,owner,wine.id,wine.producer,wine.country);
    aliasOwner.set(key,entity.id);
    report.winesRelinked++;
    // The wine's cuvée still belongs to the producer it just left, so it is
    // resolved again under the new one; recognized_wine_name keeps the name it
    // was saved under even when a merge rewrote wine_name.
    await linkWineCuvee(db,owner,wine.id).catch(()=>null);
    if(wine.cuvee_id)await cleanupOrphanCuvee(db,owner,wine.cuvee_id).catch(()=>false);
    if(!spend()){report.capped=true;return report}
  }
  return report;
}
