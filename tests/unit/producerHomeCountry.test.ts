import { describe,expect,it } from 'vitest';
import { canonicalCountryName } from '../../src/lib/wine/canonicalize';
import { mapProducerRow,pickProducerHomeCountry,refreshProducerHomeCountry } from '../../src/lib/producers/entities';
import { createD1Stub } from './support/d1Stub';
import app from '../../worker/cuveeEntry';
import { createSession } from '../../src/lib/auth/session';

const AUTH_SECRET='test-secret-value-long-enough-for-hmac';

const producerRow=(homeCountry:string|null,researchedAt:string|null=null)=>({
  id:'producer-1',canonical_name:'Wiston Estate',home_country:homeCountry,researched_at:researchedAt
});

function stub(homeCountry:string|null,researchedAt:string|null,wines:Array<{country:string;wines:number}>){
  return createD1Stub(sql=>{
    if(/FROM producers/.test(sql))return {first:{home_country:homeCountry,researched_at:researchedAt}};
    if(/GROUP BY trim\(country\)/.test(sql))return {all:wines};
    return undefined;
  });
}

describe('one name per country',()=>{
  it('files England, the UK and Great Britain under the United Kingdom',()=>{
    expect(canonicalCountryName('England')).toBe('United Kingdom');
    expect(canonicalCountryName('UK')).toBe('United Kingdom');
    expect(canonicalCountryName('Great Britain')).toBe('United Kingdom');
    expect(canonicalCountryName('Wales')).toBe('United Kingdom');
    expect(canonicalCountryName('United Kingdom')).toBe('United Kingdom');
  });

  it('leaves a country the tree does not carry exactly as written',()=>{
    expect(canonicalCountryName('Georgia')).toBe('Georgia');
    expect(canonicalCountryName('')).toBe('');
    expect(canonicalCountryName(null)).toBeNull();
  });

  it('reports the canonical name for a producer already stored under a synonym',()=>{
    expect(mapProducerRow(producerRow('England')).homeCountry).toBe('United Kingdom');
    expect(mapProducerRow(producerRow(null)).homeCountry).toBeNull();
  });
});

describe('which country a producer is filed under',()=>{
  it('takes the commonest country, not the most recent bottle',()=>{
    expect(pickProducerHomeCountry([{country:'France',wines:6},{country:'Italy',wines:1}])).toBe('France');
  });

  it('counts two spellings of one country together',()=>{
    expect(pickProducerHomeCountry([{country:'United Kingdom',wines:1},{country:'England',wines:2}])).toBe('United Kingdom');
    expect(pickProducerHomeCountry([{country:'England',wines:3},{country:'France',wines:2}])).toBe('United Kingdom');
  });

  it('breaks a tie the same way every time',()=>{
    expect(pickProducerHomeCountry([{country:'Italy',wines:2},{country:'France',wines:2}])).toBe('France');
    expect(pickProducerHomeCountry([{country:'France',wines:2},{country:'Italy',wines:2}])).toBe('France');
  });

  it('answers nothing when no wine says where it is from',()=>{
    expect(pickProducerHomeCountry([])).toBeNull();
    expect(pickProducerHomeCountry([{country:'  ',wines:4}])).toBeNull();
  });
});

describe('a corrected wine country reaches the producer',()=>{
  it('moves an unresearched producer to where its wines now say',async()=>{
    const db=stub('England',null,[{country:'United Kingdom',wines:2}]);
    expect(await refreshProducerHomeCountry(db.db,'owner','producer-1')).toBe(true);
    const [write]=db.writes();
    expect(write.sql).toMatch(/UPDATE producers SET home_country=/);
    expect(write.args[0]).toBe('United Kingdom');
  });

  it('leaves a researched producer alone: research knows where the domaine is',async()=>{
    const db=stub('England','2026-08-01T00:00:00.000Z',[{country:'United Kingdom',wines:2}]);
    expect(await refreshProducerHomeCountry(db.db,'owner','producer-1')).toBe(false);
    expect(db.writes()).toHaveLength(0);
  });

  it('does not write when the answer has not moved',async()=>{
    const db=stub('United Kingdom',null,[{country:'England',wines:2},{country:'United Kingdom',wines:1}]);
    expect(await refreshProducerHomeCountry(db.db,'owner','producer-1')).toBe(false);
    expect(db.writes()).toHaveLength(0);
  });

  it('does not blank a home country when every wine has lost its own',async()=>{
    const db=stub('United Kingdom',null,[]);
    expect(await refreshProducerHomeCountry(db.db,'owner','producer-1')).toBe(false);
    expect(db.writes()).toHaveLength(0);
  });
});

describe('the producers page groups by one name per country',()=>{
  it('lists a producer stored under a synonym in its canonical panel',async()=>{
    const stub=createD1Stub(sql=>{
      if(/FROM producers p WHERE p.owner_id=\?/.test(sql))return {all:[
        {id:'p1',canonical_name:'Wiston Estate',home_country:'United Kingdom',home_region:null,home_locality:null,researched_at:null,catalog_json:'[]',tasted_count:1},
        {id:'p2',canonical_name:'Hambledon Vineyard',home_country:'England',home_region:null,home_locality:null,researched_at:null,catalog_json:'[]',tasted_count:1}
      ]};
      if(/FROM producer_aliases/.test(sql))return {all:[]};
      return undefined;
    });
    const response=await app.fetch(new Request('https://x/api/producers',{
      headers:{authorization:`Bearer ${await createSession('owner',AUTH_SECRET)}`}
    }),{DB:stub.db,AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p',GEMINI_API_KEY:'k',
      ASSETS:{fetch:async()=>new Response('spa')}} as never,
      {waitUntil:()=>undefined,passThroughOnException:()=>undefined} as never);
    expect(response.status).toBe(200);
    const {items}=await response.json() as {items:Array<{homeCountry:string|null}>};
    expect(items.map(item=>item.homeCountry)).toEqual(['United Kingdom','United Kingdom']);
  });
});
