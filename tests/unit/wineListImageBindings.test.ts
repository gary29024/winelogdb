import { expect,it,vi } from 'vitest';
import app from '../../worker/index';
import { createSession } from '../../src/lib/auth/session';
import { migratedSqliteD1 } from './support/sqliteD1';

it('loads images for a full 100-wine page without exceeding D1 bindings or leaking owners',async()=>{
  const {db,sqlite}=migratedSqliteD1(),counts:Array<{sql:string;count:number}>=[];
  try{
    const wine=sqlite.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES(?,'owner','Estate',?,'2026-01-01','2026-01-01')");
    const image=sqlite.prepare("INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,created_at) VALUES(?,?,?,?,'image/jpeg',100,1000,1000,'uploaded','2026-01-01')");
    for(let i=0;i<100;i++){wine.run(`w${i}`,`Wine ${i}`);image.run(`image${i}`,'owner',`w${i}`,`key${i}`)}
    image.run('foreign-image','someone-else','w0','foreign-key');
    const prepare=db.prepare.bind(db);
    vi.spyOn(db,'prepare').mockImplementation(sql=>{
      const statement=prepare(sql),bind=statement.bind.bind(statement);
      vi.spyOn(statement,'bind').mockImplementation((...values)=>{
        counts.push({sql,count:values.length});
        if(values.length>100)throw new Error('D1_ERROR: too many SQL variables');
        return bind(...values);
      });
      return statement;
    });
    const secret='test-secret-value-long-enough-for-hmac';
    const response=await app.fetch(new Request('https://x/api/wines?limit=100',{headers:{Authorization:`Bearer ${await createSession('owner',secret)}`}}),{DB:db,AUTH_SECRET:secret,APP_URL:'https://x'} as never,{} as never);
    expect(response.status,await response.clone().text()).toBe(200);
    const body=await response.json() as {items:Array<{id:string;imageIds:string[]}>};
    expect(body.items).toHaveLength(100);
    for(const item of body.items)expect(item.imageIds).toEqual([`image${item.id.slice(1)}`]);
    expect(counts.find(call=>call.sql.startsWith('SELECT id,wine_id FROM wine_images'))?.count).toBe(2);
  }finally{vi.restoreAllMocks();sqlite.close()}
});
