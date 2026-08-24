import { linkWineProducer,seedProducerCountryFromWine } from '../producers/entities';
import { linkWineCuvee } from '../cuvees/entities';

type WineIdentityRow={producer:string;producer_id:string|null;cuvee_id:string|null;country:string|null};

// True once a wine is attached to both a producer and a cuvee entity, which is the
// steady state for every saved wine.
export const wineIdentityResolved=(wine:Pick<WineIdentityRow,'producer_id'|'cuvee_id'>)=>Boolean(wine.producer_id&&wine.cuvee_id);

// Reading a wine used to re-derive its producer and cuvee links on every request,
// costing several D1 reads and at least one row write per view even when nothing
// changed — and each of those writes invalidated the cached achievement progress.
// Backfill only what is genuinely missing. The save paths clear cuvee_id when a wine
// is renamed, and the daily maintenance sweep repairs anything left behind, so this
// stays correct while making a repeat read free.
export async function ensureWineIdentity(db:D1Database,owner:string,wineId:string){
  const wine=await db.prepare('SELECT producer,producer_id,cuvee_id,country FROM wines WHERE owner_id=? AND id=?').bind(owner,wineId).first<WineIdentityRow>();
  if(!wine||wineIdentityResolved(wine))return;
  let producerId=wine.producer_id;
  if(!producerId&&wine.producer?.trim())producerId=(await linkWineProducer(db,owner,wineId,wine.producer,wine.country)).id;
  else if(producerId)await seedProducerCountryFromWine(db,owner,producerId,wine.country);
  await linkWineCuvee(db,owner,wineId);
}
