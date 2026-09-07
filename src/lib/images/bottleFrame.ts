/**
 * Where the bottle and its label sit inside one photograph.
 *
 * Coordinates are the same 0-to-1000 frame the group scan already speaks, so a
 * box means the same thing wherever it came from and nothing has to be
 * converted on the way to a canvas.
 *
 * A measured photograph with no bottle in it stores a frame of nulls rather
 * than nothing at all. That distinction is the whole point of storing this:
 * NULL means never asked, and asking costs a vision call, so a photograph the
 * model could not read must remember that it was already read.
 */
export type BottleBox={xMin:number;yMin:number;xMax:number;yMax:number};
export type BottleFrame={bottle:BottleBox|null;label:BottleBox|null};

/** Sixteen is a full card, and the only thing that asks for these. */
export const MAX_FRAME_LOOKUP=16;

const coordinate=(value:unknown)=>{
  const number=Number(value);
  return Number.isFinite(number)?Math.min(1000,Math.max(0,number)):null;
};

/** A box only counts when it has all four corners and encloses something. */
export function readBottleBox(value:unknown):BottleBox|null{
  if(!value||typeof value!=='object')return null;
  const raw=value as Record<string,unknown>;
  const xMin=coordinate(raw.xMin),yMin=coordinate(raw.yMin),xMax=coordinate(raw.xMax),yMax=coordinate(raw.yMax);
  if(xMin==null||yMin==null||xMax==null||yMax==null)return null;
  return xMax>xMin&&yMax>yMin?{xMin,yMin,xMax,yMax}:null;
}

export function parseBottleFrame(stored:unknown):BottleFrame|null{
  if(typeof stored!=='string'||!stored)return null;
  try{
    const raw=JSON.parse(stored) as unknown;
    // An array or a bare number is not a frame that was ever written here, and
    // reading it as "measured, nothing found" would settle the question for
    // good on the strength of a corrupt value.
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
    const frame=raw as Record<string,unknown>;
    return {bottle:readBottleBox(frame.bottle),label:readBottleBox(frame.label)};
  }catch{return null}
}

export const serializeBottleFrame=(frame:BottleFrame)=>JSON.stringify({bottle:frame.bottle,label:frame.label});

type Row={id:string;bottle_box:string|null};

/**
 * The frames already measured for these photographs.
 *
 * Owner-scoped and capped, because this is called with whatever ids a card
 * happens to be showing. Ids with no row, or a row never measured, are simply
 * absent from the map - the caller decides whether that is worth a vision call.
 */
export async function readBottleFrames(db:D1Database,owner:string,imageIds:string[]){
  const ids=[...new Set(imageIds.filter(Boolean))].slice(0,MAX_FRAME_LOOKUP);
  const frames=new Map<string,BottleFrame>();
  if(!ids.length)return frames;
  const {results}=await db.prepare(`SELECT id,bottle_box FROM wine_images WHERE owner_id=? AND id IN (${ids.map(()=>'?').join(',')})`)
    .bind(owner,...ids).all<Row>();
  for(const row of results??[]){
    const frame=parseBottleFrame(row.bottle_box);
    if(frame)frames.set(String(row.id),frame);
  }
  return frames;
}

export async function writeBottleFrame(db:D1Database,owner:string,imageId:string,frame:BottleFrame){
  const result=await db.prepare('UPDATE wine_images SET bottle_box=? WHERE owner_id=? AND id=?')
    .bind(serializeBottleFrame(frame),owner,imageId).run();
  return Boolean(result.meta.changes);
}
