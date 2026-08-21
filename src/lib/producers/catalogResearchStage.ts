export type CatalogStageSource={title:string;url:string};
export type CatalogStageRow<T=Record<string,unknown>>={sliceKey:string;range:T[];sources:CatalogStageSource[];model:string};

type StageInput<T>={owner:string;requestId:string;producerId:string;sliceKey:string;range:T[];sources:CatalogStageSource[];model:string};
const now=()=>new Date().toISOString();
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

export async function prepareProducerCatalogStage(db:D1Database,owner:string,producerId:string,requestId:string){
  const stamp=now();
  await db.batch([
    db.prepare('DELETE FROM producer_catalog_research_stage WHERE owner_id=? AND request_id=?').bind(owner,requestId),
    db.prepare("DELETE FROM producer_catalog_research_stage WHERE updated_at<datetime('now','-7 days')").bind()
  ]);
  return stamp;
}

export async function stageProducerCatalogParts<T>(db:D1Database,parts:StageInput<T>[]){
  if(!parts.length)return;
  const stamp=now();
  await db.batch(parts.map(part=>db.prepare(`INSERT INTO producer_catalog_research_stage(owner_id,request_id,producer_id,slice_key,range_json,sources_json,model,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(owner_id,request_id,slice_key) DO UPDATE SET producer_id=excluded.producer_id,range_json=excluded.range_json,sources_json=excluded.sources_json,model=excluded.model,updated_at=excluded.updated_at`)
    .bind(part.owner,part.requestId,part.producerId,part.sliceKey,JSON.stringify(part.range),JSON.stringify(part.sources),part.model,stamp,stamp)));
}

export async function listProducerCatalogStage<T=Record<string,unknown>>(db:D1Database,owner:string,producerId:string,requestId:string):Promise<CatalogStageRow<T>[]>{
  const rows=await db.prepare(`SELECT slice_key,range_json,sources_json,model FROM producer_catalog_research_stage
    WHERE owner_id=? AND producer_id=? AND request_id=? ORDER BY slice_key`).bind(owner,producerId,requestId).all<{slice_key:string;range_json:string;sources_json:string;model:string}>();
  return rows.results.map(row=>({sliceKey:row.slice_key,range:parseJson<T[]>(row.range_json,[]),sources:parseJson<CatalogStageSource[]>(row.sources_json,[]),model:row.model}));
}

export async function discardProducerCatalogStage(db:D1Database,owner:string,requestId:string){
  await db.prepare('DELETE FROM producer_catalog_research_stage WHERE owner_id=? AND request_id=?').bind(owner,requestId).run();
}
