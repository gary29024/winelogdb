import { describe,expect,it } from 'vitest';
import { gatewayErrorDetails } from '../../src/lib/producers/gatewayError';

const response=(body:unknown,headers:HeadersInit={})=>new Response(JSON.stringify(body),{status:429,headers});
describe('safe Gateway error diagnostics',()=>{
  it('retains Z.ai codes and retry timing without echoing credentials or evidence',async()=>{
    const result=await gatewayErrorDetails(response({error:{code:'1302',message:'Concurrency limit: Bearer secret-key; wine evidence and private prompt'}},{'Retry-After':'30'}));
    expect(result).toEqual({httpStatus:429,providerCode:'1302',providerMessage:'Z.AI concurrency limit reported',retryAfter:'30'});
    expect(JSON.stringify(result)).not.toMatch(/secret-key|wine evidence|private prompt/);
  });
  it('handles Cloudflare errors and HTTP-date retry headers',async()=>{
    expect(await gatewayErrorDetails(response({errors:[{code:2003,message:'Rate limit exceeded'}]},{'Retry-After':'Sun, 13 Sep 2026 13:30:00 GMT'}))).toEqual({httpStatus:429,providerCode:'2003',providerMessage:'Rate limit reported',retryAfter:'Sun, 13 Sep 2026 13:30:00 GMT'});
  });
  it('withholds arbitrary codes, messages, and malformed retry headers',async()=>{
    expect(await gatewayErrorDetails(response({error:{code:'sk-secret',message:'private research text'}},{'Retry-After':'secret-key'}))).toEqual({httpStatus:429,providerMessage:'Unrecognized provider message withheld'});
  });
  it('preserves status for non-JSON and oversized error bodies',async()=>{
    expect(await gatewayErrorDetails(new Response('<html>private gateway error</html>',{status:502}))).toEqual({httpStatus:502});
    expect(await gatewayErrorDetails(response({error:{code:1305,message:'rate limit '+ 'x'.repeat(20_000)}}))).toEqual({httpStatus:429});
  });
  it('preserves status and retry timing when body reading fails',async()=>{
    const body=new ReadableStream({start(controller){controller.error(new Error('aborted'))}});
    expect(await gatewayErrorDetails(new Response(body,{status:429,headers:{'Retry-After':'60'}}))).toEqual({httpStatus:429,retryAfter:'60'});
  });
});