export type StubReply={first?:unknown;all?:unknown[];changes?:number};
export type StubCall={sql:string;args:unknown[]};

const collapse=(sql:string)=>sql.replace(/\s+/g,' ').trim();

// Minimal D1 double: it records every statement that is actually executed so a test
// can assert on the number and kind of reads and writes a code path performs.
export function createD1Stub(reply:(sql:string,args:unknown[])=>StubReply|undefined=()=>undefined){
  const calls:StubCall[]=[];
  const statement=(sql:string,args:unknown[]):Record<string,unknown>=>({
    bind:(...next:unknown[])=>statement(sql,next),
    first:async()=>{calls.push({sql,args});return reply(sql,args)?.first??null},
    all:async()=>{calls.push({sql,args});return {results:reply(sql,args)?.all??[],success:true}},
    run:async()=>{calls.push({sql,args});return {success:true,meta:{changes:reply(sql,args)?.changes??1}}}
  });
  const db={
    prepare:(sql:string)=>statement(sql,[]),
    batch:async(statements:Array<{all:()=>Promise<unknown>}>)=>Promise.all(statements.map(item=>item.all()))
  };
  return {
    db:db as unknown as D1Database,
    calls,
    sql:()=>calls.map(call=>collapse(call.sql)),
    matching:(pattern:RegExp)=>calls.filter(call=>pattern.test(collapse(call.sql))),
    // Anything that can change stored rows. Read paths must not produce these.
    writes:()=>calls.filter(call=>/^\s*(insert|update|delete)\b/i.test(collapse(call.sql)))
  };
}
