// @vitest-environment jsdom
import { afterEach,describe,expect,it,vi } from 'vitest';

afterEach(()=>vi.unstubAllGlobals());

async function confirmWith(status:number,body:unknown){
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const {confirmBatchWine}=await import('../../src/features/uploads/batchApi');
  return confirmBatchWine('s1','i1',{} as never).then(()=>null).catch((error:Error)=>error);
}

describe('what a batch review says when the server refuses',()=>{
  it('names the field, not just the refusal',async()=>{
    // Reported as: "Invalid wine", and nothing else, on a Calvados the schema
    // would not take. The server had always sent the field; this client read
    // the title and dropped the rest.
    const error=await confirmWith(400,{error:'Invalid wine',
      issues:[{path:['alcoholPercentage'],message:'Too big: expected number to be <=70'}]});
    expect(error?.message).toContain('Invalid wine');
    expect(error?.message).toContain('alcoholPercentage');
    expect(error?.message).toContain('<=70');
  });

  it('lists every field that failed',async()=>{
    const error=await confirmWith(400,{error:'Invalid wine',issues:[
      {path:['alcoholPercentage'],message:'Too big'},{path:['vintage'],message:'Too small'}]});
    expect(error?.message).toContain('alcoholPercentage: Too big');
    expect(error?.message).toContain('vintage: Too small');
  });

  it('still says something useful when the server sends no detail',async()=>{
    expect((await confirmWith(500,{}))?.message).toBe('Could not save this wine (500)');
    expect((await confirmWith(400,{error:'Session expired'}))?.message).toBe('Session expired');
  });
});
