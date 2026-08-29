/**
 * A tasting you are at.
 *
 * The tastings table has always been written on every wine save, keyed on
 * (owner, name, date) by resolveTasting. This adds the missing half: a session
 * you start once and that every wine saved during it joins, without retyping
 * the event on all fourteen bottles.
 *
 * Nothing accumulates in the browser. Each wine is committed when it is saved
 * and the tasting is only the row it joins, so a refresh, a killed PWA or
 * another device loses nothing - which matters when an evening runs four hours.
 */
export type Tasting={
  id:string;name:string;tastingDate:string|null;venue:string|null;
  startedAt:string|null;endedAt:string|null;lastWineAt:string|null;
  createdAt:string;updatedAt:string;
};
export type TastingSummary=Tasting&{wineCount:number;averageRating:number|null};

/**
 * How long an open tasting may go without a wine before it is treated as over.
 *
 * Measured from the last wine rather than from the start: a tasting that runs
 * past 3am is still live at 02:45, and closing it on elapsed time since it
 * began would end it mid-evening. Ten hours closes a forgotten one by morning
 * without ever interrupting a real one - the day-change rule is the fast path,
 * and this only catches a tasting nobody ever logged anything else into.
 */
export const TASTING_STALE_MS=10*60*60*1000;

const now=()=>new Date().toISOString();
const text=(value:unknown)=>{const trimmed=String(value??'').trim();return trimmed||null};

type Row=Record<string,unknown>;
export const mapTasting=(row:Row):Tasting=>({
  id:String(row.id),name:String(row.name),
  tastingDate:row.tasting_date?String(row.tasting_date):null,
  venue:row.venue?String(row.venue):null,
  startedAt:row.started_at?String(row.started_at):null,
  endedAt:row.ended_at?String(row.ended_at):null,
  lastWineAt:row.last_wine_at?String(row.last_wine_at):null,
  createdAt:String(row.created_at),updatedAt:String(row.updated_at)
});

const OPEN='started_at IS NOT NULL AND ended_at IS NULL';
const closeOpen=(db:D1Database,owner:string,stamp:string)=>
  db.prepare(`UPDATE tastings SET ended_at=?,updated_at=? WHERE owner_id=? AND ${OPEN}`).bind(stamp,stamp,owner);

/**
 * Starts a tasting, closing whatever was open.
 *
 * The date comes from the client: it is part of the tasting's identity and of
 * the prefill, and a server clock between midnight and 08:00 in Hong Kong
 * reports the previous day. Starting on a name and date that already exist
 * adopts that row rather than failing on the unique index - "I logged two
 * bottles already, now let me start the tasting properly" keeps those bottles.
 */
export async function startTasting(db:D1Database,owner:string,input:{name:string;tastingDate:string;venue?:string|null}){
  const name=text(input.name),tastingDate=text(input.tastingDate);
  if(!name)throw new Error('A tasting needs a name');
  if(!tastingDate)throw new Error('A tasting needs a date');
  const stamp=now(),id=crypto.randomUUID();
  await db.batch([
    closeOpen(db,owner,stamp),
    db.prepare(`INSERT INTO tastings(id,owner_id,name,tasting_date,venue,started_at,ended_at,last_wine_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,NULL,NULL,?,?)
      ON CONFLICT(owner_id,name,coalesce(tasting_date,'')) DO UPDATE SET
        started_at=excluded.started_at,ended_at=NULL,
        venue=coalesce(tastings.venue,excluded.venue),updated_at=excluded.updated_at`)
      .bind(id,owner,name,tastingDate,text(input.venue),stamp,stamp,stamp)
  ]);
  const row=await db.prepare('SELECT * FROM tastings WHERE owner_id=? AND name=? AND coalesce(tasting_date,\'\')=?')
    .bind(owner,name,tastingDate).first<Row>();
  return row?mapTasting(row):null;
}

/** True once an open tasting has gone quiet for longer than a tasting lasts. */
export function tastingLooksStale(tasting:Pick<Tasting,'startedAt'|'endedAt'|'lastWineAt'>,nowMs=Date.now()){
  if(!tasting.startedAt||tasting.endedAt)return false;
  const since=Date.parse(tasting.lastWineAt??tasting.startedAt);
  return Number.isFinite(since)&&nowMs-since>TASTING_STALE_MS;
}

/**
 * Closes a stale tasting on the way out, so reading is what settles it - the
 * same write-on-read the research campaign uses instead of a cron. The JS
 * predicate gates the write: an ordinary read of "nothing is open" must stay a
 * single indexed probe and no writes at all.
 */
export async function settleStaleTasting(db:D1Database,owner:string,tasting:Tasting|null){
  if(!tasting||!tastingLooksStale(tasting))return tasting;
  const stamp=now();
  await db.prepare(`UPDATE tastings SET ended_at=?,updated_at=? WHERE owner_id=? AND id=? AND ended_at IS NULL`)
    .bind(stamp,stamp,owner,tasting.id).run().catch(()=>undefined);
  return {...tasting,endedAt:stamp,updatedAt:stamp};
}

export async function readActiveTasting(db:D1Database,owner:string){
  const row=await db.prepare(`SELECT * FROM tastings WHERE owner_id=? AND ${OPEN} LIMIT 1`).bind(owner).first<Row>();
  const settled=await settleStaleTasting(db,owner,row?mapTasting(row):null);
  return settled&&!settled.endedAt?settled:null;
}

export async function endTasting(db:D1Database,owner:string,id:string){
  const stamp=now();
  // Guarded on ended_at, but a second press is a success rather than an error:
  // two devices can both be looking at the same open tasting.
  await db.prepare('UPDATE tastings SET ended_at=?,updated_at=? WHERE owner_id=? AND id=? AND ended_at IS NULL')
    .bind(stamp,stamp,owner,id).run();
  return readTastingRow(db,owner,id);
}

/** For an evening that turned out not to be over. Closes whatever else is open. */
export async function reopenTasting(db:D1Database,owner:string,id:string){
  const stamp=now();
  await db.batch([
    closeOpen(db,owner,stamp),
    db.prepare('UPDATE tastings SET started_at=coalesce(started_at,?),ended_at=NULL,updated_at=? WHERE owner_id=? AND id=?')
      .bind(stamp,stamp,owner,id)
  ]);
  return readTastingRow(db,owner,id);
}

export async function readTastingRow(db:D1Database,owner:string,id:string){
  const row=await db.prepare('SELECT * FROM tastings WHERE owner_id=? AND id=?').bind(owner,id).first<Row>();
  return row?mapTasting(row):null;
}

export async function updateTasting(db:D1Database,owner:string,id:string,patch:{name?:string|null;venue?:string|null}){
  // Deliberately not the date: it is in the unique index, in the prefill and in
  // resolveTasting's lookup, so changing it would orphan every wine saved so far.
  const name=patch.name===undefined?null:text(patch.name),venue=patch.venue===undefined?undefined:text(patch.venue);
  if(patch.name!==undefined&&!name)throw new Error('A tasting needs a name');
  const stamp=now();
  await db.prepare(`UPDATE tastings SET name=coalesce(?,name),venue=CASE WHEN ?=1 THEN ? ELSE venue END,updated_at=?
    WHERE owner_id=? AND id=?`).bind(name,venue===undefined?0:1,venue??null,stamp,owner,id).run();
  return readTastingRow(db,owner,id);
}

export async function deleteTasting(db:D1Database,owner:string,id:string){
  const result=await db.prepare('DELETE FROM tastings WHERE owner_id=? AND id=?').bind(owner,id).run();
  return Boolean(result.meta.changes);
}

/**
 * Recent tastings with their counts, aggregated in SQL rather than by loading
 * every wine - the list says how each evening went, and only the one opened
 * needs its lineup.
 */
export async function listTastings(db:D1Database,owner:string,limit=50):Promise<TastingSummary[]>{
  const capped=Math.max(1,Math.min(100,Math.floor(limit)||50));
  const {results}=await db.prepare(`SELECT t.*,count(we.id) AS wine_count,avg(we.rating) AS average_rating
    FROM tastings t LEFT JOIN wine_experiences we ON we.owner_id=t.owner_id AND we.tasting_id=t.id
    WHERE t.owner_id=? GROUP BY t.id
    ORDER BY (CASE WHEN ${OPEN} THEN 0 ELSE 1 END),coalesce(t.tasting_date,t.created_at) DESC,t.created_at DESC
    LIMIT ?`).bind(owner,capped).all<Row>();
  return (results??[]).map(row=>({...mapTasting(row),
    wineCount:Number(row.wine_count)||0,
    averageRating:row.average_rating==null?null:Number(row.average_rating)}));
}

export type TastingWine={
  wineId:string;producer:string;wineName:string;vintage:number|null;wineStyle:string|null;
  appellation:string|null;region:string|null;country:string|null;
  rating:number|null;consumedAt:string|null;notes:string;imageId:string|null;
};

/**
 * The lineup, in pour order rather than journal order, driving off
 * idx_wine_experiences_tasting. A wine poured twice in one evening appears
 * twice: that is two pours, and collapsing them would lose one.
 */
export async function readTastingWines(db:D1Database,owner:string,id:string):Promise<TastingWine[]>{
  const {results}=await db.prepare(`SELECT we.id AS experience_id,w.id AS wine_id,w.producer,w.wine_name,w.vintage,w.wine_style,
      w.appellation,w.region,w.country,
      coalesce(we.rating,w.rating) AS rating,
      coalesce(we.consumed_at,w.tasting_date) AS consumed_at,
      coalesce(we.tasting_notes,'') AS notes,
      (SELECT wi.id FROM wine_images wi WHERE wi.owner_id=w.owner_id AND wi.wine_id=w.id ORDER BY wi.rowid ASC LIMIT 1) AS image_id
    FROM wine_experiences we JOIN wines w ON w.owner_id=we.owner_id AND w.id=we.wine_id
    WHERE we.owner_id=? AND we.tasting_id=?
    ORDER BY we.consumed_at ASC,we.created_at ASC`).bind(owner,id).all<Row>();
  return (results??[]).map(row=>({
    wineId:String(row.wine_id),producer:String(row.producer),wineName:String(row.wine_name),
    vintage:row.vintage==null?null:Number(row.vintage),
    wineStyle:row.wine_style?String(row.wine_style):null,
    appellation:row.appellation?String(row.appellation):null,
    region:row.region?String(row.region):null,
    country:row.country?String(row.country):null,
    rating:row.rating==null?null:Number(row.rating),
    consumedAt:row.consumed_at?String(row.consumed_at):null,
    notes:String(row.notes??''),
    imageId:row.image_id?String(row.image_id):null
  }));
}

/**
 * Ends the open tasting when a wine is saved for a different day.
 *
 * One conditional UPDATE, no read. Because the form is prefilled from the
 * tasting row rather than from today's date, this fires only when someone
 * changes the date field - on intent, never on the clock passing midnight.
 *
 * Call on wine creation only. saveExperience is shared with PUT /api/wines/:id,
 * and running this there would end tonight's tasting the moment an old wine was
 * edited.
 */
export async function closeOpenTastingIfDayChanged(db:D1Database,owner:string,tastingDate:string|null|undefined){
  const date=text(tastingDate);
  if(!date)return;
  const stamp=now();
  await db.prepare(`UPDATE tastings SET ended_at=?,updated_at=? WHERE owner_id=? AND ${OPEN} AND coalesce(tasting_date,'')<>?`)
    .bind(stamp,stamp,owner,date).run().catch(()=>undefined);
}

/** Keeps the open tasting alive. Creation only, for the same reason. */
export async function touchTastingActivity(db:D1Database,owner:string,tastingId:string|null|undefined){
  if(!tastingId)return;
  const stamp=now();
  await db.prepare(`UPDATE tastings SET last_wine_at=?,updated_at=? WHERE owner_id=? AND id=? AND ${OPEN}`)
    .bind(stamp,stamp,owner,tastingId).run().catch(()=>undefined);
}
