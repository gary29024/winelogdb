import { describe, expect, it } from 'vitest';
import { wineInputSchema } from '../../src/lib/db/schema';

const base={
  producer:'Test Producer',wineName:'Test Wine',country:null,region:null,appellation:null,
  grapes:[],grapeBlend:[],wineStyle:'red' as const,alcoholPercentage:13,
  tastingNotes:'',rating:null,tastingDate:null,event:null,venue:null,price:null,currency:null,
  tags:[],tastingName:null,locationName:null,latitude:null,longitude:null,
  recognitionStatus:'complete' as const,recognitionConfidence:0.9
};

describe('wineInputSchema vintage',()=>{
  it.each([2021,'2021',' 2021 '])('accepts %p as vintage 2021',(vintage)=>{
    const parsed=wineInputSchema.safeParse({...base,vintage});
    expect(parsed.success).toBe(true);
    if(parsed.success)expect(parsed.data.vintage).toBe(2021);
  });

  it.each([null,''])('accepts %p as no vintage',(vintage)=>{
    const parsed=wineInputSchema.safeParse({...base,vintage});
    expect(parsed.success).toBe(true);
    if(parsed.success)expect(parsed.data.vintage).toBeNull();
  });

  it('rejects a non-year vintage',()=>{
    const parsed=wineInputSchema.safeParse({...base,vintage:'twenty twenty-one'});
    expect(parsed.success).toBe(false);
  });
});
