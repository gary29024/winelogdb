import { wineTargets,type CreditOperation } from './credits';
import { sharedSubjectKey } from '../../src/lib/research/shared';
import { producerSubjectKey } from '../../src/lib/research/sharedProducer';
import { askableVintage,vintageCacheKey,type VintageSubject } from '../../src/lib/maturity/vintageWindow';
export async function workKey(db:D1Database,user:string,path:string,request?:Request){
 if(path==='/api/maturity/vintage'&&request){const subject=await request.clone().json() as VintageSubject;return askableVintage(subject)&&subject.country&&subject.wineStyle?`vintage:${vintageCacheKey(subject)}`:null}
 const wine=path.match(/^\/api\/wines\/([^/]+)\/deep-search$/);
 if(wine){const row=await db.prepare('SELECT * FROM wines WHERE id=? AND owner_id=?').bind(wine[1],user).first<Record<string,unknown>>();if(!row)return null;const key=sharedSubjectKey(wineTargets(row).find(t=>t.scope==='wine_vintage')!);return key?`wine:${key}`:null}
 const producer=path.match(/^\/api\/producers\/([^/]+)\/research$/);
 if(producer){const row=await db.prepare('SELECT * FROM producers WHERE id=? AND owner_id=?').bind(producer[1],user).first<Record<string,unknown>>();const key=row?producerSubjectKey(row):null;return key?`producer:${key}`:null}
 return null;
}
export async function activeFriendWork(db:D1Database,user:string,key:string|null){
 if(!key)return null;
 return db.prepare(`SELECT o.* FROM research_work w JOIN credit_operations o ON o.id=w.operation_id
 JOIN friendships f ON f.user_id=? AND f.friend_id=w.owner_id JOIN app_users u ON u.id=w.owner_id AND u.status='active'
 WHERE w.subject_key=? AND o.status IN ('reserved','running')`).bind(user,key).first<CreditOperation>();
}
