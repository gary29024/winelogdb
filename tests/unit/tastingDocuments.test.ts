import { describe,expect,it } from 'vitest';
import { createD1Stub } from './support/d1Stub';
import { addTastingDocuments,deleteTastingDocument,readTastingDocument,type DocumentEnv } from '../../src/lib/tastings/documents';

const page=(name='list.jpg',type='image/jpeg',bytes=64)=>new File([new Uint8Array(bytes)],name,{type});

function bucket(){
  const objects=new Map<string,{metadata?:Record<string,string>}>();
  const r2={
    put:async(key:string,_body:unknown,options?:{customMetadata?:Record<string,string>})=>{objects.set(key,{metadata:options?.customMetadata})},
    get:async(key:string)=>objects.has(key)?{body:null as unknown as ReadableStream}:null,
    delete:async(key:string)=>{objects.delete(key)}
  };
  return {objects,r2:r2 as unknown as R2Bucket};
}

const env=(db:D1Database,r2:R2Bucket):DocumentEnv=>({DB:db,WINE_IMAGES:r2});

describe('the printed wine list',()=>{
  it('stores every page of one list in a single call',async()=>{
    // Organisers hand out two or three sheets, and photographing them is one
    // action, not three.
    const stub=createD1Stub(sql=>/SELECT id FROM tastings/.test(sql)?{first:{id:'t1'}}:undefined);
    const store=bucket();
    const saved=await addTastingDocuments(env(stub.db,store.r2),'owner','t1',[page('a.jpg'),page('b.jpg')]);
    expect(saved).toHaveLength(2);
    expect(store.objects.size).toBe(2);
    expect(stub.matching(/INSERT INTO tasting_documents/)).toHaveLength(2);
  });

  it('accepts a list uploaded to a closed tasting',async()=>{
    // The sheet usually arrives at the end, or the next day. Requiring the
    // evening to be reopened first would be exactly backwards.
    const stub=createD1Stub(sql=>/SELECT id FROM tastings/.test(sql)?{first:{id:'t1'}}:undefined);
    const store=bucket();
    await expect(addTastingDocuments(env(stub.db,store.r2),'owner','t1',[page()])).resolves.toHaveLength(1);
    expect(stub.sql().some(sql=>/ended_at/.test(sql))).toBe(false);
  });

  it('marks the object as a wine list so a sweep can tell it from a working file',async()=>{
    // Batch recognition images expire on a TTL because they are scratch. A wine
    // list is the record of an evening and goes only when its tasting does.
    const stub=createD1Stub(sql=>/SELECT id FROM tastings/.test(sql)?{first:{id:'t1'}}:undefined);
    const store=bucket();
    await addTastingDocuments(env(stub.db,store.r2),'owner','t1',[page()]);
    expect([...store.objects.values()][0].metadata).toMatchObject({kind:'tasting-document',tasting:'t1'});
  });

  it('rejects a tasting that is gone, a file that is not an image, and one that is too large',async()=>{
    const missing=createD1Stub();
    const store=bucket();
    await expect(addTastingDocuments(env(missing.db,store.r2),'owner','t1',[page()])).rejects.toThrow(/no longer exists/);

    const stub=createD1Stub(sql=>/SELECT id FROM tastings/.test(sql)?{first:{id:'t1'}}:undefined);
    await expect(addTastingDocuments(env(stub.db,store.r2),'owner','t1',[page('list.pdf','application/pdf')])).rejects.toThrow(/JPEG/);
    await expect(addTastingDocuments(env(stub.db,store.r2),'owner','t1',[page('big.jpg','image/jpeg',11*1024*1024)])).rejects.toThrow(/10MB/);
    expect(store.objects.size).toBe(0);
  });

  it('serves nothing for a document that is not the caller own',async()=>{
    // Ownership is in the WHERE clause, so another owner's id simply finds no
    // row - R2 is never asked for the object.
    const stub=createD1Stub();
    const store=bucket();
    expect(await readTastingDocument(env(stub.db,store.r2),'someone-else','d1')).toBeNull();
  });

  it('deletes the row and the object together',async()=>{
    const stub=createD1Stub(sql=>/SELECT object_key FROM tasting_documents/.test(sql)?{first:{object_key:'owner/a.jpg'}}:undefined);
    const store=bucket();
    store.objects.set('owner/a.jpg',{});
    expect(await deleteTastingDocument(env(stub.db,store.r2),'owner','d1')).toBe(true);
    expect(store.objects.size).toBe(0);
    expect(stub.matching(/^DELETE FROM tasting_documents/)).toHaveLength(1);
  });
});
