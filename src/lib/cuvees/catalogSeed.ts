import { syncProducerCatalogCuvees } from './entities';

export async function ensureProducerCatalogCuveesSeeded(db:D1Database,owner:string,producerId:string){
  const seeded=await db.prepare('SELECT id FROM cuvees WHERE owner_id=? AND producer_id=? AND catalog_backed=1 LIMIT 1').bind(owner,producerId).first<{id:string}>();
  if(seeded?.id)return;
  await syncProducerCatalogCuvees(db,owner,producerId);
}
