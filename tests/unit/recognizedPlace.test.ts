import { describe,expect,it } from 'vitest';
import app from '../../worker/index';
import { mapWine } from '../../worker/index';
import { createSession } from '../../src/lib/auth/session';
import { canonicalizeWineFields } from '../../src/lib/wine/canonicalize';
import { createD1Stub } from './support/d1Stub';

const AUTH_SECRET='test-secret-value-long-enough-for-hmac';

const wine=(over:Record<string,unknown>={})=>({
  producer:'Ridge',wineName:'Monte Bello',vintage:2019,country:'United States',
  region:'California',appellation:'Oakville, Napa Valley',wineStyle:'red',
  grapes:['Cabernet Sauvignon'],grapeBlend:[],tags:[],tastingNotes:'',...over
});

async function put(body:Record<string,unknown>){
  const stub=createD1Stub();
  const token=await createSession('owner',AUTH_SECRET);
  const res=await app.fetch(new Request('https://x/api/wines/w1',{
    method:'PUT',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},
    body:JSON.stringify(body)
  }),{DB:stub.db,AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p'} as never);
  const call=stub.calls.find(entry=>/^UPDATE wines SET/.test(entry.sql));
  return {status:res.status,sql:call?.sql??'',args:call?.args??[]};
}

describe('What the label was read as',()=>{
  it('keeps the place fields as they arrived, beside the normalised ones',()=>{
    // Normalisation rewrites both columns: "California" is not a growing region
    // and "Oakville, Napa Valley" is two places. Without a record of the input
    // there is no way to tell a good reading from a mis-slotted one afterwards.
    const saved=canonicalizeWineFields(wine());
    expect(saved).toMatchObject({region:'Napa Valley',appellation:'Oakville',
      recognizedRegion:'California',recognizedAppellation:'Oakville, Napa Valley'});
  });

  it('trims blank readings to null rather than storing an empty string',()=>{
    expect(canonicalizeWineFields(wine({region:'  ',appellation:''})))
      .toMatchObject({recognizedRegion:null,recognizedAppellation:null});
  });

  it('leaves an already-recorded reading alone on a re-save',()=>{
    // The edit form submits the normalised values, so re-deriving from them
    // would quietly replace the original reading with WineLog's own answer.
    const first=canonicalizeWineFields(wine());
    expect(canonicalizeWineFields({...first})).toMatchObject({
      recognizedRegion:'California',recognizedAppellation:'Oakville, Napa Valley'});
  });
});

describe('Writing the reading to the row',()=>{
  it('sends both columns on an update',async()=>{
    const {status,sql,args}=await put(wine());
    expect(status).toBe(200);
    expect(sql).toContain('recognized_region=?');
    expect(sql).toContain('recognized_appellation=?');
    expect(args).toContain('California');
    expect(args).toContain('Oakville, Napa Valley');
  });

  it('takes the reading the caller sends, so a wrong one can be taken back',async()=>{
    // This was COALESCE, which made the first reading permanent. The first save
    // cannot tell a label from a typo someone typed into the review form, so a
    // hand-entered appellation was filed as what the bottle said and shown back
    // as "AS RECORDED" with no way to remove it. The form round-trips the
    // reading it loaded, so preserving it is the caller's job, and clearing the
    // field it describes clears it.
    const {sql}=await put(wine());
    expect(sql).not.toContain('COALESCE(recognized_');
    const {args}=await put(wine({recognizedRegion:null,recognizedAppellation:null,region:null,appellation:null}));
    expect(args.filter(value=>value==='Oakville, Napa Valley')).toEqual([]);
  });

  it('reads both columns back out into the response',()=>{
    expect(mapWine({recognized_region:'California',recognized_appellation:'Oakville, Napa Valley'}))
      .toMatchObject({recognizedRegion:'California',recognizedAppellation:'Oakville, Napa Valley'});
    expect(mapWine({})).toMatchObject({recognizedRegion:null,recognizedAppellation:null});
  });
});
