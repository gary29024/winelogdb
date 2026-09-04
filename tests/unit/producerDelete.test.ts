import { describe,expect,it,vi } from 'vitest';
import { createD1Stub } from './support/d1Stub';
import { deleteProducerEntity } from '../../src/lib/producers/remove';

const bucket=()=>({delete:vi.fn(async()=>undefined)});
const stubFor=(overrides:{producer?:unknown;wines?:number}={})=>createD1Stub(sql=>{
  if(/FROM producers WHERE owner_id=\? AND id=\?/.test(sql))
    return {first:overrides.producer===undefined
      ? {id:'p1',canonical_name:'Château Orphan',hero_image_object_key:'owner/hero.jpg'}
      : overrides.producer};
  if(/COUNT\(\*\) AS n FROM wines/.test(sql))return {first:{n:overrides.wines??0}};
  return undefined;
});

describe('deleting a producer',()=>{
  // Reported as: correcting a bottle's producer leaves the one it used to be
  // behind, empty, with no way to remove it and a place in every producer list
  // from then on.

  it('takes the record and everything keyed on it',async()=>{
    const stub=stubFor(),images=bucket();
    const result=await deleteProducerEntity({DB:stub.db,WINE_IMAGES:images as unknown as R2Bucket},'owner','p1');
    expect(result).toEqual({id:'p1',canonicalName:'Château Orphan',deleted:true});
    const deleted=stub.writes().map(call=>call.sql.replace(/\s+/g,' ').match(/DELETE FROM (\w+)/)![1]);
    expect(new Set(deleted)).toEqual(new Set([
      'cuvee_catalog_links','cuvee_aliases','cuvees','producer_aliases','producer_manual_contacts',
      'producer_catalog_decisions','producer_catalog_research_stage','producer_research_runs',
      'producer_research_history','producer_merges','producer_research_campaign_items','producers'
    ]));
    expect(stub.writes().every(call=>call.args.includes('owner')||call.args.includes('p1')),'every statement is scoped').toBe(true);
  });

  it('takes the hero image with it, and only after the rows are gone',async()=>{
    const stub=stubFor(),images=bucket();
    await deleteProducerEntity({DB:stub.db,WINE_IMAGES:images as unknown as R2Bucket},'owner','p1');
    expect(images.delete).toHaveBeenCalledWith('owner/hero.jpg');
  });

  it('leaves R2 alone when there was no hero image',async()=>{
    const stub=stubFor({producer:{id:'p1',canonical_name:'Plain',hero_image_object_key:null}}),images=bucket();
    await deleteProducerEntity({DB:stub.db,WINE_IMAGES:images as unknown as R2Bucket},'owner','p1');
    expect(images.delete).not.toHaveBeenCalled();
  });

  it('refuses a producer that still has wines, and says how many',async()=>{
    // The wines are the reason the record exists. Merging is what moves them;
    // this would only orphan them.
    const stub=stubFor({wines:4}),images=bucket();
    await expect(deleteProducerEntity({DB:stub.db,WINE_IMAGES:images as unknown as R2Bucket},'owner','p1'))
      .rejects.toThrow(/still has 4 wines attached/);
    expect(stub.writes(),'nothing is removed').toHaveLength(0);
    expect(images.delete).not.toHaveBeenCalled();
  });

  it('counts a wine held by one of its cuvées as attached',async()=>{
    // A wine whose producer_id was cleared but whose cuvee still belongs here is
    // attached just as firmly, and is the drift the guard exists for.
    const stub=stubFor({wines:1});
    await expect(deleteProducerEntity({DB:stub.db,WINE_IMAGES:bucket() as unknown as R2Bucket},'owner','p1'))
      .rejects.toThrow(/still has 1 wine attached/);
    expect(stub.matching(/cuvee_id IN \(SELECT id FROM cuvees/),'the cuvée side is counted too').toHaveLength(1);
  });

  it('says so when the producer is not there',async()=>{
    const stub=stubFor({producer:null});
    await expect(deleteProducerEntity({DB:stub.db,WINE_IMAGES:bucket() as unknown as R2Bucket},'owner','gone'))
      .rejects.toThrow('Producer not found');
  });
});
