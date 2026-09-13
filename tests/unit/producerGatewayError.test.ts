import { describe,expect,it } from 'vitest';
import { gatewayErrorDetails } from '../../src/lib/producers/gatewayError';

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

  it('keeps arbitrary provider messages out of diagnostics',async()=>{
    const response=new Response(JSON.stringify({error:{message:'Unexpected upstream text with customer-specific content'}}),{status:502,headers:{'Content-Type':'application/json'}});
    expect(await gatewayErrorDetails(response)).toEqual({httpStatus:502,providerMessage:'Unrecognized provider message withheld'});
  });
});
