/**
 * Deleting a producer that nothing points at any more.
 *
 * Reported as: correcting a bottle's producer leaves the one it used to be
 * behind, with no wines, no way to remove it, and a place in every producer
 * list from then on. Merging is for two records of the same estate; renaming is
 * for one that was read wrong. Neither is what an empty record needs.
 *
 * Only an empty one. A producer with wines is the identity those wines hang
 * from - their cuvées, their catalogue links, the Passport's count of estates -
 * so this refuses and says how many, rather than orphaning them. Merge it into
 * the right producer and the wines move with it; then it is empty, and this
 * removes it.
 */
export type ProducerDeleteEnv={DB:D1Database;WINE_IMAGES:R2Bucket};

/** Everything keyed on a producer by one id, deepest first. */
const BY_PRODUCER=[
  'DELETE FROM cuvee_catalog_links WHERE owner_id=? AND producer_id=?',
  'DELETE FROM cuvee_aliases WHERE owner_id=? AND producer_id=?',
  'DELETE FROM cuvees WHERE owner_id=? AND producer_id=?',
  'DELETE FROM producer_aliases WHERE owner_id=? AND producer_id=?',
  'DELETE FROM producer_manual_contacts WHERE owner_id=? AND producer_id=?',
  'DELETE FROM producer_catalog_decisions WHERE owner_id=? AND producer_id=?',
  'DELETE FROM producer_catalog_research_stage WHERE owner_id=? AND producer_id=?',
  'DELETE FROM producer_research_runs WHERE owner_id=? AND producer_id=?'
] as const;

/**
 * Merge records naming it on either side.
 *
 * Both directions, because neither survives the producer: a merge into a record
 * that no longer exists cannot be undone into it, and one out of it would
 * restore the very record being removed.
 */
const BY_EITHER_SIDE=[
  'DELETE FROM producer_research_history WHERE owner_id=? AND (producer_id=? OR origin_producer_id=?)',
  'DELETE FROM producer_merges WHERE owner_id=? AND (destination_producer_id=? OR source_producer_id=?)'
] as const;

export async function deleteProducerEntity(env:ProducerDeleteEnv,owner:string,producerId:string){
  const producer=await env.DB.prepare('SELECT id,canonical_name,hero_image_object_key FROM producers WHERE owner_id=? AND id=?')
    .bind(owner,producerId).first<{id:string;canonical_name:string;hero_image_object_key:string|null}>();
  if(!producer)throw new Error('Producer not found');

  // A wine whose producer_id was cleared but whose cuvee still belongs here is
  // attached just as firmly, and is exactly the drift this guard exists for.
  const attached=await env.DB.prepare(`SELECT COUNT(*) AS n FROM wines WHERE owner_id=?
    AND (producer_id=? OR cuvee_id IN (SELECT id FROM cuvees WHERE owner_id=? AND producer_id=?))`)
    .bind(owner,producerId,owner,producerId).first<{n:number}>();
  const wines=Number(attached?.n)||0;
  if(wines>0)throw new Error(`${producer.canonical_name} still has ${wines} wine${wines===1?'':'s'} attached. Merge it into the right producer first, or change those wines, and it can then be removed.`);

  await env.DB.batch([
    ...BY_PRODUCER.map(sql=>env.DB.prepare(sql).bind(owner,producerId)),
    ...BY_EITHER_SIDE.map(sql=>env.DB.prepare(sql).bind(owner,producerId,producerId)),
    // Campaign items carry no owner of their own, so they are reached through
    // the campaigns that do.
    env.DB.prepare('DELETE FROM producer_research_campaign_items WHERE producer_id=? AND campaign_id IN (SELECT id FROM producer_research_campaigns WHERE owner_id=?)').bind(producerId,owner),
    env.DB.prepare('DELETE FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId)
  ]);

  // After the rows, and never before: an image deleted ahead of a batch that
  // then fails leaves a producer with a broken hero.
  if(producer.hero_image_object_key)await env.WINE_IMAGES.delete(producer.hero_image_object_key).catch(()=>undefined);
  return {id:producerId,canonicalName:producer.canonical_name,deleted:true as const};
}

/**
 * Throwing away a producer photograph that says nothing.
 *
 * Reported as: research often comes back with a meaningless picture - a stock
 * close-up of grapes rather than the estate. No rule can judge "meaningful", so
 * the person looking at it decides, and the URL is remembered as refused: a
 * later run would otherwise fetch the same picture straight back. The URL and
 * not a flag, so a site that changes its own picture may still offer the new
 * one.
 */
export async function rejectProducerHeroImage(env:ProducerDeleteEnv,owner:string,producerId:string){
  const producer=await env.DB.prepare('SELECT hero_image_object_key,hero_image_source_url FROM producers WHERE owner_id=? AND id=?')
    .bind(owner,producerId).first<{hero_image_object_key:string|null;hero_image_source_url:string|null}>();
  if(!producer)throw new Error('Producer not found');
  if(!producer.hero_image_object_key)return {id:producerId,removed:false as const};
  await env.DB.prepare('UPDATE producers SET hero_image_object_key=NULL,hero_image_source_url=NULL,hero_image_rejected_url=?,updated_at=? WHERE owner_id=? AND id=?')
    .bind(producer.hero_image_source_url,new Date().toISOString(),owner,producerId).run();
  await env.WINE_IMAGES.delete(producer.hero_image_object_key).catch(()=>undefined);
  return {id:producerId,removed:true as const};
}
