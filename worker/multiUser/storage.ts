import { ApiError,boundedBytes,settings,stamp } from './common';

export function meteredBucket(bucket:R2Bucket,db:D1Database,owner:string,policy:{skipMemberLimit?:boolean;countsTowardMemberLimit?:boolean}={}):R2Bucket{
 return new Proxy(bucket,{get(target,key){
  if(key==='put')return async(objectKey:string,value:ReadableStream|ArrayBuffer|ArrayBufferView|string|Blob|null,options?:R2PutOptions)=>{
   const config=await settings(db);
   const bytes=value===null?new ArrayBuffer(0):typeof value==='string'?new TextEncoder().encode(value):value instanceof Blob?await boundedBytes(value.stream(),12*1024*1024):value instanceof ReadableStream?await boundedBytes(value,12*1024*1024):value;
   const length=bytes.byteLength;if(length>12*1024*1024)throw new ApiError(413,'Object exceeds the upload limit');
   const previous=await db.prepare('SELECT owner_id,byte_size,counts_toward_member_limit FROM stored_objects WHERE object_key=?').bind(objectKey).first<{owner_id:string;byte_size:number;counts_toward_member_limit:number}>();
   if(previous&&previous.owner_id!==owner)throw new ApiError(403,'Object belongs to another account');
   const memberMetered=policy.countsTowardMemberLimit===false?0:1;
   const result=await db.prepare(`INSERT INTO stored_objects(object_key,owner_id,byte_size,counts_toward_member_limit,updated_at)
    SELECT ?,?,?,?,? WHERE (?=1 OR ?=0 OR coalesce((SELECT metered_byte_size FROM storage_totals WHERE owner_id=?),0)+?-coalesce((SELECT CASE WHEN counts_toward_member_limit=1 THEN byte_size ELSE 0 END FROM stored_objects WHERE object_key=?),0)<=?)
    AND (?=0 OR coalesce((SELECT byte_size FROM storage_totals WHERE owner_id='*'),0)+?-coalesce((SELECT byte_size FROM stored_objects WHERE object_key=?),0)<=?)
    ON CONFLICT(object_key) DO UPDATE SET byte_size=excluded.byte_size,counts_toward_member_limit=excluded.counts_toward_member_limit,updated_at=excluded.updated_at`).bind(
      objectKey,owner,length,memberMetered,stamp(),
      policy.skipMemberLimit?1:0,config.memberStorageBytes,owner,memberMetered?length:0,objectKey,config.memberStorageBytes,
      config.totalStorageBytes,length,objectKey,config.totalStorageBytes
    ).run();
   if(!result.meta.changes)throw new ApiError(413,'Storage limit reached');
   // On uncertain R2 failure the reservation remains conservative until inventory.
   return target.put(objectKey,bytes,options);
  };
  if(key==='delete')return async(keys:string|string[])=>{const items=typeof keys==='string'?[keys]:keys;for(const item of items){const row=await db.prepare('SELECT owner_id FROM stored_objects WHERE object_key=?').bind(item).first<{owner_id:string}>();if(row&&row.owner_id!==owner)throw new ApiError(403,'Object belongs to another account')}await target.delete(keys);for(const item of items)await db.prepare('DELETE FROM stored_objects WHERE object_key=? AND owner_id=?').bind(item,owner).run()};
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
}
