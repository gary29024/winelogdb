import { describe,expect,it } from 'vitest';
import { batchExperienceSchema,shouldReplaceVenueFallback } from '../../src/lib/journal/batchExperience';

const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];

describe('Journal batch experience input',()=>{
  it('allows updating event only and treats a blank value as clear',()=>{
    expect(batchExperienceSchema.parse({ids,tastingName:'  Dinner  '})).toMatchObject({ids,tastingName:'Dinner'});
    expect(batchExperienceSchema.parse({ids,tastingName:'   '})).toMatchObject({ids,tastingName:null});
  });

  it('allows venue only or both fields while preserving omitted fields',()=>{
    const venueOnly=batchExperienceSchema.parse({ids,venue:'Clubhouse'});
    expect(venueOnly.venue).toBe('Clubhouse');
    expect(venueOnly.tastingName).toBeUndefined();
    expect(batchExperienceSchema.parse({ids,tastingName:'WSET',venue:null})).toMatchObject({tastingName:'WSET',venue:null});
  });

  it('rejects a request with no batch field selected',()=>{
    expect(batchExperienceSchema.safeParse({ids}).success).toBe(false);
  });

  it('deduplicates wine ids',()=>{
    expect(batchExperienceSchema.parse({ids:[ids[0],ids[0]],venue:'A'}).ids).toEqual([ids[0]]);
  });
});

describe('venue fallback preservation',()=>{
  it('updates an empty or venue-derived location when venue changes',()=>{
    expect(shouldReplaceVenueFallback(null,'Restaurant A')).toBe(true);
    expect(shouldReplaceVenueFallback('Restaurant A','Restaurant A')).toBe(true);
    expect(shouldReplaceVenueFallback(' restaurant a ','Restaurant A')).toBe(true);
  });

  it('preserves an independently captured place name',()=>{
    expect(shouldReplaceVenueFallback('Central, Hong Kong','Restaurant A')).toBe(false);
  });
});
