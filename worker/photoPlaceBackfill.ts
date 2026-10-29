import { requiredPhotoPlaceName,validCoordinates } from '../src/lib/places/photoPlace';
import type { ReferenceSource } from '../src/lib/wine/referenceCatalog';

/**
 * Saved wines still carry the places the label model guessed before photo
 * places came from GPS (docs/photo-places.md). This renames a saved place from
 * its GPS only while it is still exactly what a recorded scan proposed: a batch
 * or group scan's result, or a single scan's reply for the same coordinates. A
 * place a member typed or cleared stays, and so does any place with no scan
 * record, since nothing tells those apart from typed ones.
 */

export const PLACE_BACKFILL_BATCH=25;
export type PlaceNamer=(latitude:number,longitude:number)=>Promise<string|null>;
/** A guarded update, and whether it renames a place a member sees. */
export type PlaceRename={statement:D1PreparedStatement;counted:boolean};

type Located={id:string;owner_id:string;wine_id:string;latitude:unknown;longitude:unknown;location_name:string|null};
const text=(value:unknown)=>typeof value==='string'?value.trim():'';

/** One lookup per coordinates for a chunk; a missing reference file throws. */
export function placeNamer(bucket:ReferenceSource):PlaceNamer{
  const names=new Map<string,Promise<string|null>>();
  return (latitude,longitude)=>{
    const key=`${latitude},${longitude}`;let name=names.get(key);
    if(!name){name=requiredPhotoPlaceName(bucket,latitude,longitude);names.set(key,name)}
    return name;
  };
}

// Every place each wine's scans proposed. A single scan is not linked to the
// wine it created, but its reply carries the photo's exact coordinates, which
// the form saved unchanged on the tasting.
const SCAN_PROPOSALS=`SELECT b.confirmed_wine_id AS wine_id,json_extract(b.recognition_json,'$.locationName') AS proposal
  FROM batch_recognition_items b JOIN wines w ON w.id=b.confirmed_wine_id AND w.owner_id=b.owner_id
  WHERE w.id IN (SELECT value FROM json_each(?)) AND json_valid(b.recognition_json)
 UNION ALL SELECT g.saved_wine_id,json_extract(g.recognition_json,'$.locationName')
  FROM group_recognition_items g JOIN wines w ON w.id=g.saved_wine_id AND w.owner_id=g.owner_id
  WHERE w.id IN (SELECT value FROM json_each(?)) AND g.manual=0 AND json_valid(g.recognition_json)
 UNION ALL SELECT we.wine_id,json_extract(o.response_json,'$.locationName')
  FROM wine_experiences we JOIN wines w ON w.id=we.wine_id AND w.owner_id=we.owner_id
  JOIN credit_operations o ON o.user_id=we.owner_id AND o.path='/api/recognition' AND o.status='complete' AND json_valid(o.response_json)
   AND json_extract(o.response_json,'$.latitude')=we.latitude AND json_extract(o.response_json,'$.longitude')=we.longitude
  WHERE w.id IN (SELECT value FROM json_each(?))`;

/**
 * Tasting places and photo places of the next wines after `cursor`. Tastings
 * are counted: renamed, kept as typed, or kept for want of a scan record.
 */
export async function savedWinePlaces(db:D1Database,name:PlaceNamer,cursor:string,limit=PLACE_BACKFILL_BATCH){
  const wines=(await db.prepare('SELECT id FROM wines WHERE id>? ORDER BY id LIMIT ?').bind(cursor,limit).all<{id:string}>()).results;
  const renames:PlaceRename[]=[];let kept=0,unrecorded=0;
  if(!wines.length)return {rows:0,cursor,renames,kept,unrecorded};
  const ids=JSON.stringify(wines.map(wine=>wine.id)),stamp=new Date().toISOString();
  const [experiences,photos,proposals]=await db.batch<Record<string,unknown>>([
    db.prepare(`SELECT we.id,we.owner_id,we.wine_id,we.latitude,we.longitude,we.location_name FROM wine_experiences we JOIN wines w ON w.id=we.wine_id AND w.owner_id=we.owner_id
      WHERE w.id IN (SELECT value FROM json_each(?)) AND we.latitude IS NOT NULL AND we.longitude IS NOT NULL ORDER BY we.wine_id,we.id`).bind(ids),
    db.prepare(`SELECT i.id,i.owner_id,i.wine_id,i.latitude,i.longitude,i.location_name FROM wine_images i JOIN wines w ON w.id=i.wine_id AND w.owner_id=i.owner_id
      WHERE w.id IN (SELECT value FROM json_each(?)) AND i.latitude IS NOT NULL AND i.longitude IS NOT NULL ORDER BY i.wine_id,i.id`).bind(ids),
    db.prepare(SCAN_PROPOSALS).bind(ids,ids,ids)
  ]);
  const proposed=new Map<string,Set<string>>();
  for(const row of proposals.results){const wine=String(row.wine_id),seen=proposed.get(wine)??new Set<string>();seen.add(text(row.proposal));proposed.set(wine,seen)}
  for(const row of experiences.results as Located[]){
    if(!validCoordinates(row.latitude,row.longitude))continue;
    const current=text(row.location_name),named=await name(row.latitude,row.longitude as number);
    if(current===(named??''))continue;
    const scans=proposed.get(row.wine_id);
    if(!scans){unrecorded++;continue}
    if(!scans.has(current)){kept++;continue}
    // Guarded on the name just read: an edit made meanwhile wins.
    renames.push({counted:true,statement:db.prepare('UPDATE wine_experiences SET location_name=?,updated_at=? WHERE id=? AND owner_id=? AND location_name IS ?').bind(named,stamp,row.id,row.owner_id,row.location_name)});
  }
  // Photos keep their own copy of the place, which new photos of the wine inherit.
  for(const row of photos.results as Located[]){
    const current=text(row.location_name);
    if(!validCoordinates(row.latitude,row.longitude)||!proposed.get(row.wine_id)?.has(current))continue;
    const named=await name(row.latitude,row.longitude as number);
    if(current!==(named??''))renames.push({counted:false,statement:db.prepare('UPDATE wine_images SET location_name=? WHERE id=? AND owner_id=? AND location_name IS ?').bind(named,row.id,row.owner_id,row.location_name)});
  }
  return {rows:wines.length,cursor:wines.at(-1)!.id,renames,kept,unrecorded};
}

/** Batch Scan results nobody has reviewed yet: the proposal itself is renamed before it is saved. */
export async function pendingBatchPlaces(db:D1Database,name:PlaceNamer,cursor:string,limit=PLACE_BACKFILL_BATCH){
  const items=(await db.prepare(`SELECT id,owner_id,json_extract(recognition_json,'$.latitude') AS latitude,json_extract(recognition_json,'$.longitude') AS longitude,json_extract(recognition_json,'$.locationName') AS location_name
    FROM batch_recognition_items WHERE status='ready' AND id>? AND json_valid(recognition_json) ORDER BY id LIMIT ?`).bind(cursor,limit).all<Omit<Located,'wine_id'>>()).results;
  const renames:PlaceRename[]=[];
  for(const item of items){
    if(!validCoordinates(item.latitude,item.longitude))continue;
    const named=await name(item.latitude,item.longitude as number);
    if(text(item.location_name)!==(named??''))renames.push({counted:true,statement:db.prepare(`UPDATE batch_recognition_items SET recognition_json=json_set(recognition_json,'$.locationName',?)
      WHERE id=? AND owner_id=? AND status='ready' AND json_extract(recognition_json,'$.locationName') IS ?`).bind(named,item.id,item.owner_id,item.location_name)});
  }
  return {rows:items.length,cursor:items.at(-1)?.id??cursor,renames};
}
