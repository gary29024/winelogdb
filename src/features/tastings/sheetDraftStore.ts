import type { SheetLineupWine,SheetMatch } from './api';

/**
 * The last reading of a wine list, kept until it is thrown away on purpose.
 *
 * Reading a list is the most expensive thing the app does - one AI call per
 * page, on a sheet that can run to seven - and until now closing the screen
 * threw the whole result away. Coming back to fill in the prices later meant
 * paying to read the same paper again.
 *
 * Local rather than server-side on purpose: this is a half-finished review, not
 * a record. The wines, the prices and the photographed pages are all already on
 * the server the moment they are written; what is kept here is only the
 * in-between state of a screen, on the device the screen was open on. That
 * makes it free, private to the phone it was scanned on, and safe to lose - the
 * worst case is the scan people have today.
 */
const KEY='winelog-sheet-drafts';
/** Bumped when the shape changes, so an old draft is dropped rather than misread. */
const VERSION=1;
const MAX_AGE_MS=30*24*60*60*1000;

export type SheetDraftRow=SheetMatch&{key:string;chosenPrice:number|null;selected:boolean;manualWineId:string|null};
export type SheetDraft={
  version:number;savedAt:string;
  rows:SheetDraftRow[];lineup:SheetLineupWine[];
  currency:string;unresolved:number;partial:boolean;
};
type DraftFile=Record<string,SheetDraft>;

/** Storage is unavailable in a private window and throws rather than returning null. */
function readAll():DraftFile{
  try{
    const raw=localStorage.getItem(KEY);if(!raw)return {};
    const parsed=JSON.parse(raw) as DraftFile;
    return parsed&&typeof parsed==='object'?parsed:{};
  }catch{return {}}
}

function writeAll(file:DraftFile){
  try{localStorage.setItem(KEY,JSON.stringify(file))}
  catch{/* full, or a private window: the draft is a convenience, never a record */}
}

const fresh=(draft:SheetDraft|undefined)=>
  Boolean(draft&&draft.version===VERSION&&Date.now()-Date.parse(draft.savedAt)<MAX_AGE_MS);

export function readSheetDraft(tastingId:string):SheetDraft|null{
  const draft=readAll()[tastingId];
  return fresh(draft)&&draft.rows.length?draft:null;
}

export function writeSheetDraft(tastingId:string,draft:Omit<SheetDraft,'version'|'savedAt'>){
  if(!draft.rows.length){clearSheetDraft(tastingId);return}
  const file=readAll();
  // Stale drafts are dropped on the way past rather than by a sweep of their
  // own: this runs on every edit, and a tasting nobody reopens should not keep
  // a month-old review alive in storage forever.
  for(const [id,existing] of Object.entries(file))if(!fresh(existing))delete file[id];
  file[tastingId]={...draft,version:VERSION,savedAt:new Date().toISOString()};
  writeAll(file);
}

export function clearSheetDraft(tastingId:string){
  const file=readAll();
  if(!(tastingId in file))return;
  delete file[tastingId];writeAll(file);
}

/** "23 Aug", for saying how old a restored reading is without a wall of text. */
export const sheetDraftAge=(savedAt:string)=>{
  const at=new Date(savedAt);
  return Number.isNaN(at.getTime())?'':at.toLocaleDateString(undefined,{day:'numeric',month:'short'});
};
