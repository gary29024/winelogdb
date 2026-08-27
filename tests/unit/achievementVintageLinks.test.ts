import { describe,expect,it } from 'vitest';
import { buildAchievementProgress } from '../../src/features/achievements/engine';
import type { AchievementDefinition,AchievementIdentityRegistry,AchievementWine } from '../../src/features/achievements/types';

const registry:AchievementIdentityRegistry={
  producers:[{id:'p-montelena',canonicalName:'Chateau Montelena',aliases:[]}],
  cuvees:[{id:'c-chardonnay',producerId:'p-montelena',canonicalName:'Chardonnay',aliases:[],appellation:'Napa Valley'}]
};

const wine=(id:string,vintage:number|null,tastingDate:string|null):AchievementWine=>({
  id,producerId:'p-montelena',cuveeId:'c-chardonnay',producer:'Chateau Montelena',
  wineName:'Chardonnay',vintage,appellation:'Napa Valley',tastingDate
});

/** The Judgment of Paris shape: the target names a 1973 that almost nobody has. */
const definition={
  id:'test-collection',title:'Test',subtitle:'',icon:'judgment-paris',category:'Test',references:[],
  items:[{id:'montelena-1973',label:'Chateau Montelena Chardonnay 1973',
    selector:{type:'wine_vintage',producerNames:['Chateau Montelena'],cuveeNames:['Chardonnay'],vintage:1973}}]
} as unknown as AchievementDefinition;

const itemFor=(wines:AchievementWine[],mode:'exact'|'cuvee'|'producer'='producer')=>
  buildAchievementProgress(definition,registry,wines,mode).items[0];

describe('which tasting a checklist row opens',()=>{
  // Reported as: with several vintages tasted, "View tasting" pointed at a
  // different one between two loads. Nothing was choosing - the wines arrived
  // in whatever order the query plan produced.
  const tasted=[
    wine('w-2021',2021,'2024-03-02'),
    wine('w-2024',2024,'2026-08-01'),
    wine('w-2013',2013,'2019-11-20'),
    wine('w-2022',2022,'2025-06-14')
  ];

  it('offers one link per tasted vintage, oldest vintage first',()=>{
    const item=itemFor(tasted);
    expect(item.tastedVintageLinks).toEqual([
      {vintage:2013,wineId:'w-2013'},{vintage:2021,wineId:'w-2021'},
      {vintage:2022,wineId:'w-2022'},{vintage:2024,wineId:'w-2024'}
    ]);
    // and the line of vintages still reads the same way it always did
    expect(item.tastedVintages).toEqual([2013,2021,2022,2024]);
  });

  it('opens the most recent tasting of a vintage tasted more than once',()=>{
    const item=itemFor([...tasted,wine('w-2022-again',2022,'2026-02-09')]);
    expect(item.tastedVintageLinks.find(link=>link.vintage===2022)?.wineId).toBe('w-2022-again');
  });

  it('leads with the most recent tasting overall',()=>{
    expect(itemFor(tasted).tastedWineIds[0]).toBe('w-2024');
  });

  it('prefers the vintage the target actually names',()=>{
    // Landing on a 2013 from a row that says 1973 is the confusing part, even
    // when the 1973 was drunk years earlier than everything else.
    const item=itemFor([...tasted,wine('w-1973',1973,'2015-05-05')],'cuvee');
    expect(item.tastedWineIds[0]).toBe('w-1973');
  });

  it('is stable when nothing has a tasting date',()=>{
    const undated=[wine('w-b',2020,null),wine('w-a',2019,null),wine('w-c',2021,null)];
    const first=itemFor(undated).tastedWineIds;
    const shuffled=itemFor([...undated].reverse()).tastedWineIds;
    expect(first).toEqual(shuffled);
    // id order is the tiebreak, so the answer does not depend on row order
    expect(first[0]).toBe('w-a');
  });

  it('gives the same answer whatever order the wines arrive in',()=>{
    const forwards=itemFor(tasted);
    const backwards=itemFor([...tasted].reverse());
    expect(backwards.tastedWineIds).toEqual(forwards.tastedWineIds);
    expect(backwards.tastedVintageLinks).toEqual(forwards.tastedVintageLinks);
  });

  it('has nothing to link when nothing matched',()=>{
    const item=itemFor([]);
    expect(item.tastedVintageLinks).toEqual([]);
    expect(item.status).toBe('pending');
  });
});
