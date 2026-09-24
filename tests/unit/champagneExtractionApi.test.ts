import { afterEach,expect,it,vi } from 'vitest';
import { getChampagneExtraction } from '../../src/features/wines/champagneExtractionApi';
import { missingChampagneDetails } from '../../src/lib/wine/champagneExtraction';

vi.mock('../../src/lib/auth/client',()=>({apiFetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,init),authHeaders:()=>({}),clearSession:vi.fn(),getSession:()=>null}));
afterEach(()=>vi.unstubAllGlobals());

it('accepts future response fields while keeping suggestions safe for the form',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({run:{
    requestId:'r',status:'complete',imageIds:['p1'],error:null,
    details:{dosageGPerL:3,disgorgement:'JANVIER 2022',futureField:'new'}
  }}))));
  const {run}=await getChampagneExtraction('w');
  expect(run?.status).toBe('complete');
  expect(missingChampagneDetails({},run?.details)).toEqual({dosageGPerL:3,disgorgement:'January 2022'});
});

it('retains completed status without throwing when known detail fields are invalid',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({run:{
    requestId:'r',status:'complete',imageIds:['p1'],error:null,details:{dosageGPerL:'invalid'}
  }}))));
  expect((await getChampagneExtraction('w')).run).toMatchObject({status:'complete',details:null});
});
