import { describe,expect,it } from 'vitest';
import { gatewayErrorDetails,isRetryableZaiProviderCode } from '../../src/lib/producers/gatewayError';

describe('producer Gateway error diagnostics',()=>{
  it('classifies a missing AI Gateway provider key without exposing raw provider text',async()=>{
    const secret='sk-test-secret-that-must-not-leak';
    const response=new Response(JSON.stringify({error:{message:`The specified key does not exist. ${secret}`}}),{status:404,headers:{'Content-Type':'application/json'}});
    const details=await gatewayErrorDetails(response);

    expect(details).toEqual({httpStatus:404,providerMessage:'AI Gateway provider key not found'});
    const logged=JSON.stringify(details);
    expect(logged).not.toContain(secret);
    expect(logged.toLowerCase()).not.toContain('specified key does not exist');
  });

  it('maps known Z.ai throttling codes to safe retryable diagnostics',async()=>{
    const secret='provider-detail-that-must-not-leak';
    const response=new Response(JSON.stringify({error:{code:1305,message:`upstream wording ${secret}`}}),{status:429,headers:{'Content-Type':'application/json','Retry-After':'2'}});
    const details=await gatewayErrorDetails(response);

    expect(details).toEqual({httpStatus:429,providerCode:'1305',providerMessage:'Z.AI rate limit triggered',retryAfter:'2'});
    expect(isRetryableZaiProviderCode(details.providerCode)).toBe(true);
    expect(JSON.stringify(details)).not.toContain(secret);
    expect(isRetryableZaiProviderCode('1302')).toBe(true);
    expect(isRetryableZaiProviderCode('1303')).toBe(true);
    expect(isRetryableZaiProviderCode('1312')).toBe(true);
    expect(isRetryableZaiProviderCode('1304')).toBe(false);
  });

  it('keeps arbitrary provider messages out of diagnostics',async()=>{
    const response=new Response(JSON.stringify({error:{message:'Unexpected upstream text with customer-specific content'}}),{status:502,headers:{'Content-Type':'application/json'}});
    expect(await gatewayErrorDetails(response)).toEqual({httpStatus:502,providerMessage:'Unrecognized provider message withheld'});
  });
});