import { describe,expect,it } from 'vitest';
import app from '../../worker/index';
import { createSession } from '../../src/lib/auth/session';
import { createD1Stub } from './support/d1Stub';

const AUTH_SECRET='test-secret-value-long-enough-for-hmac';

const wine=(over:Record<string,unknown>={})=>({
  producer:'Domaine Dujac',wineName:'Morey-Saint-Denis',vintage:2019,country:'France',
  region:'Burgundy',appellation:'Morey-Saint-Denis',wineStyle:'red',grapes:[],grapeBlend:[],tags:[],
  tastingNotes:'',tastingName:'Burgundy portfolio',tastingDate:'2026-08-28',...over
});

/** The two statements the tasting rules add to a wine save, and nothing else. */
const closes=(stub:ReturnType<typeof createD1Stub>)=>
  stub.matching(/^UPDATE tastings SET ended_at=.*coalesce\(tasting_date/);
const touches=(stub:ReturnType<typeof createD1Stub>)=>
  stub.matching(/^UPDATE tastings SET last_wine_at=/);

async function save(method:'POST'|'PUT',body:Record<string,unknown>){
  const stub=createD1Stub(sql=>{
    if(/SELECT id FROM tastings/.test(sql))return {first:{id:'t1'}};
    if(/SELECT id FROM wine_experiences/.test(sql))return {first:{id:'e1'}};
    return undefined;
  });
  const token=await createSession('owner',AUTH_SECRET);
  const url=method==='POST'?'https://x/api/wines':'https://x/api/wines/w1';
  const response=await app.fetch(new Request(url,{
    method,headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(body)
  }),{DB:stub.db,AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p'} as never);
  return {status:response.status,stub};
}

describe('what a wine save does to the open tasting',()=>{
  it('keeps a newly logged bottle alive and asks whether the day changed',async()=>{
    const {status,stub}=await save('POST',wine());
    expect(status).toBe(201);
    expect(closes(stub)).toHaveLength(1);
    expect(touches(stub)).toHaveLength(1);
  });

  it('passes the wine own date to the close check, not the server clock',async()=>{
    // This is what makes a 3am tasting safe: the form is prefilled from the
    // tasting row, so the date only differs when someone changed the field.
    const {stub}=await save('POST',wine({tastingDate:'2026-08-29'}));
    const [statement]=closes(stub);
    expect(statement.args[statement.args.length-1]).toBe('2026-08-29');
  });

  it('leaves the tasting completely alone when an old wine is edited',async()=>{
    // saveExperience is shared with PUT /api/wines/:id. Running the rules there
    // would end tonight's tasting the moment a bottle from March was corrected,
    // and re-editing an old wine would keep a finished evening alive. This is
    // the single most likely regression in the feature.
    const {status,stub}=await save('PUT',wine({tastingDate:'2026-03-14',tastingName:'March dinner'}));
    expect(status).toBe(200);
    expect(closes(stub)).toHaveLength(0);
    expect(touches(stub)).toHaveLength(0);
  });

  it('does not close anything for a wine saved with no date',async()=>{
    const {stub}=await save('POST',wine({tastingDate:null}));
    expect(closes(stub)).toHaveLength(0);
  });
});
