import { z } from 'zod';
import { validateBatch } from '../src/features/uploads/validation';
import { CHAMPAGNE_PHOTO_BYTES,CHAMPAGNE_PHOTO_LIMIT,isChampagne } from '../src/lib/wine/champagneExtraction';
import type { ProviderAuthorization } from '../src/lib/credits/provider';
import { ApiError,hash } from './multiUser/common';

export type ChampagneWine={region:string|null;appellation:string|null;wineStyle:string|null};
export const readChampagneWine=(db:D1Database,owner:string,wineId:string)=>db.prepare('SELECT region,appellation,wine_style AS wineStyle FROM wines WHERE owner_id=? AND id=?').bind(owner,wineId).first<ChampagneWine>();

export function requireChampagneWine(wine:ChampagneWine|null):asserts wine is ChampagneWine{
  if(!wine)throw new ApiError(404,'Wine not found');
  if(!isChampagne(wine))throw new ApiError(400,'Photo backfill is available for Champagne only.');
}

export async function validateChampagneImageIds(db:D1Database,owner:string,wineId:string,imageIds:string[]){
  const saved=await db.prepare('SELECT id FROM wine_images WHERE owner_id=? AND wine_id=? AND id IN (SELECT value FROM json_each(?))').bind(owner,wineId,JSON.stringify(imageIds)).all<{id:string}>();
  if(saved.results.length!==imageIds.length)throw new ApiError(400,'A selected photo no longer belongs to this wine. Refresh and try again.');
}

/** Validate identically when quoting and executing; do not stage photos while quoting. */
export async function readChampagnePhotos(request:Pick<Request,'formData'>,db:D1Database,owner:string,wineId:string){
  try{
    const form=await request.formData(),files=form.getAll('images').filter((item):item is File=>item instanceof File);
    validateBatch(files,{maxFiles:CHAMPAGNE_PHOTO_LIMIT,maxBytes:CHAMPAGNE_PHOTO_BYTES,minDimension:300,maxDimension:2000});
    const imageIds=z.array(z.string().min(1)).min(1).max(CHAMPAGNE_PHOTO_LIMIT).parse(JSON.parse(String(form.get('imageIds'))));
    if(imageIds.length!==files.length||new Set(imageIds).size!==imageIds.length)throw new ApiError(400,'Choose distinct saved photos for this wine.');
    await validateChampagneImageIds(db,owner,wineId,imageIds);
    return {files,imageIds};
  }catch(error){
    if(error instanceof ApiError)throw error;
    throw new ApiError(400,error instanceof Error?error.message:'Invalid photos');
  }
}

export const champagneInputFingerprint=(wine:ChampagneWine,imageIds:string[])=>hash(JSON.stringify([wine.region,wine.appellation,wine.wineStyle,imageIds]));

/** A queued extraction can only use the wine/photos authorized by its own quote. */
export async function assertChampagneInput(context:ProviderAuthorization|undefined,owner:string,wineId:string,requestId:string,wine:ChampagneWine,imageIds:string[]){
  if(!context||!('operationId' in context))return; // Legacy single-owner entrypoint.
  const op=await context.db.prepare('SELECT units_json,run_id FROM credit_operations WHERE id=? AND user_id=?').bind(context.operationId,owner).first<{units_json:string;run_id:string|null}>();
  const units=op?JSON.parse(op.units_json) as Array<{action:string;targetId?:string;targetFingerprint?:string}>:[];
  const unit=units.find(item=>item.action==='champagne_extraction'&&item.targetId===wineId);
  if(!unit||op?.run_id!==requestId||unit.targetFingerprint!==await champagneInputFingerprint(wine,imageIds))throw new ApiError(409,'Champagne extraction input changed; start a new extraction.');
  await validateChampagneImageIds(context.db,owner,wineId,imageIds);
}
