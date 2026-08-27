import { describe,expect,it } from 'vitest';
import { achievementDefinitions } from '../../src/features/achievements/curatedLaunch';
import { buildAchievementProgress } from '../../src/features/achievements/engine';
import type { AchievementIdentityRegistry,AchievementWine } from '../../src/features/achievements/types';

const byId=(id:string)=>achievementDefinitions.find(definition=>definition.id===id)!;
const ids=achievementDefinitions.map(definition=>definition.id);

describe('the Pomerol collection',()=>{
  it('sits with the other Bordeaux collections',()=>{
    // Pomerol beside Saint-Émilion rather than after the Michelin cards at the
    // end: the Right Bank reads as one run.
    expect(ids[ids.indexOf('pomerol-benchmark-estates')-1]).toBe('saint-emilion-2022-premiers');
  });

  it('says it is curated rather than classified',()=>{
    // Pomerol has never been classified. A collection that implied otherwise
    // would be inventing an authority.
    const pomerol=byId('pomerol-benchmark-estates');
    expect(pomerol.subtitle).toContain('no classification');
    expect(pomerol.items).toHaveLength(16);
    expect(pomerol.references[0].url).toMatch(/^https:\/\//);
  });

  it('matches an estate through the names a label actually carries',()=>{
    const registry:AchievementIdentityRegistry={
      producers:[{id:'p-vcc',canonicalName:'Vieux Château Certan',aliases:['VCC']},
        {id:'p-petrus',canonicalName:'Petrus',aliases:['Pétrus']}],
      cuvees:[]
    };
    const wines:AchievementWine[]=[
      {id:'w1',producerId:'p-vcc',producer:'VCC',wineName:'Vieux Château Certan',vintage:2016,appellation:'Pomerol'},
      {id:'w2',producerId:'p-petrus',producer:'Pétrus',wineName:'Petrus',vintage:2015,appellation:'Pomerol'}
    ];
    const result=buildAchievementProgress(byId('pomerol-benchmark-estates'),registry,wines);
    expect(result.items.filter(item=>item.status==='tasted').map(item=>item.label).sort())
      .toEqual(['Pétrus','Vieux Château Certan']);
  });
});

describe('the United States collections',()=>{
  it('adds four, kept together',()=>{
    const us=['napa-historic-estates','napa-cult-cabernets','oregon-pinot-pioneers','washington-benchmark-estates'];
    const positions=us.map(id=>ids.indexOf(id));
    expect(positions.every(position=>position>=0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a,b)=>a-b));
    expect(positions[3]-positions[0]).toBe(3);
  });

  it('carries a reference and a stable id for every estate',()=>{
    for(const id of ['napa-historic-estates','napa-cult-cabernets','oregon-pinot-pioneers','washington-benchmark-estates']){
      const definition=byId(id);
      expect(definition.references.length,id).toBeGreaterThan(0);
      expect(definition.references.every(reference=>reference.url.startsWith('https://')),id).toBe(true);
      expect(new Set(definition.items.map(item=>item.id)).size,id).toBe(definition.items.length);
      expect(definition.items.every(item=>item.selector.type==='producer'),id).toBe(true);
    }
  });

  it('names an estate by every spelling a bottle uses',()=>{
    // Inglenook has been Niebaum-Coppola and Rubicon Estate; a journal spans
    // all three.
    const registry:AchievementIdentityRegistry={
      producers:[{id:'p-ing',canonicalName:'Rubicon Estate',aliases:['Niebaum-Coppola']}],cuvees:[]
    };
    const result=buildAchievementProgress(byId('napa-historic-estates'),registry,
      [{id:'w1',producerId:'p-ing',producer:'Rubicon Estate',wineName:'Rubicon',vintage:2008,appellation:'Rutherford'}]);
    expect(result.items.find(item=>item.label==='Inglenook')?.status).toBe('tasted');
  });
});

describe('every curated collection',()=>{
  it('keeps its ids unique across the whole set',()=>{
    expect(new Set(ids).size).toBe(ids.length);
    const itemIds=achievementDefinitions.flatMap(definition=>definition.items.map(item=>`${definition.id}/${item.id}`));
    expect(new Set(itemIds).size).toBe(itemIds.length);
  });
});

describe('the Champagne collections',()=>{
  it('separates the growers from the houses',()=>{
    // Two different things: a club with a published membership, and a curated
    // set of houses with no official list since the Syndicat was dissolved.
    const club=byId('champagne-special-club'),houses=byId('champagne-prestige-houses');
    expect(club.subtitle).toContain('current member');
    expect(houses.subtitle).toContain('curated');
    expect(houses.subtitle).toContain('1997');
    expect(new Set([...club.items,...houses.items].map(item=>item.label)).size)
      .toBe(club.items.length+houses.items.length);
  });

  it('ticks a grower from the name on the bottle',()=>{
    const registry:AchievementIdentityRegistry={
      producers:[{id:'p-bereche',canonicalName:'Bérêche & Fils',aliases:['Bereche']}],cuvees:[]
    };
    const result=buildAchievementProgress(byId('champagne-special-club'),registry,
      [{id:'w1',producerId:'p-bereche',producer:'Bereche',wineName:'Special Club',vintage:2016,appellation:'Champagne'}]);
    expect(result.items.find(item=>item.label==='Bereche & Fils')?.status).toBe('tasted');
  });
});

describe('the Domaine de la Romanée-Conti collection',()=>{
  const drc=byId('domaine-romanee-conti');

  it('is a wine-by-wine checklist, not one bottle and done',()=>{
    // A producer selector would complete the card off any DRC bottle. Each
    // item names a cuvee, so the ten have to be tasted separately.
    expect(drc.items).toHaveLength(10);
    expect(drc.items.every(item=>item.selector.type==='cuvee')).toBe(true);
    expect(drc.items.map(item=>item.label)).toContain('La Tâche');
    expect(drc.items.map(item=>item.label)).toContain('Corton-Charlemagne');
  });

  it('ticks only the wine that was tasted',()=>{
    const registry:AchievementIdentityRegistry={
      producers:[{id:'p-drc',canonicalName:'Domaine de la Romanée-Conti',aliases:['DRC']}],
      cuvees:[{id:'c-tache',producerId:'p-drc',canonicalName:'La Tâche',aliases:['La Tache'],appellation:'La Tâche'}]
    };
    const result=buildAchievementProgress(drc,registry,
      [{id:'w1',producerId:'p-drc',cuveeId:'c-tache',producer:'DRC',wineName:'La Tache',vintage:2015,appellation:'La Tâche'}]);
    expect(result.completed).toBe(1);
    expect(result.items.find(item=>item.label==='La Tâche')?.status).toBe('tasted');
    expect(result.items.find(item=>item.label==='Richebourg')?.status).not.toBe('tasted');
  });
});

describe('the Italian collections',()=>{
  it('identifies a Barolo cru by the name on the label',()=>{
    // The MGAs are not appellations - a bottle says Barolo - so the cru is
    // matched from the wine name, the way the Chablis climats are.
    const registry:AchievementIdentityRegistry={
      producers:[{id:'p-rinaldi',canonicalName:'Giuseppe Rinaldi',aliases:[]}],
      cuvees:[{id:'c-brunate',producerId:'p-rinaldi',canonicalName:'Barolo Brunate',aliases:['Brunate'],appellation:'Barolo'}]
    };
    const result=buildAchievementProgress(byId('barolo-great-crus'),registry,
      [{id:'w1',producerId:'p-rinaldi',cuveeId:'c-brunate',producer:'Giuseppe Rinaldi',wineName:'Barolo Brunate',vintage:2019,appellation:'Barolo'}]);
    expect(result.items.find(item=>item.label==='Brunate')?.status).toBe('tasted');
    expect(result.items.find(item=>item.label==='Cannubi')?.status).not.toBe('tasted');
  });

  it('keeps a super Tuscan tied to its own estate',()=>{
    // Antinori make a great deal that is not Tignanello.
    const registry:AchievementIdentityRegistry={
      producers:[{id:'p-antinori',canonicalName:'Antinori',aliases:['Marchesi Antinori']}],
      cuvees:[{id:'c-tig',producerId:'p-antinori',canonicalName:'Tignanello',aliases:[],appellation:'Toscana'},
        {id:'c-villa',producerId:'p-antinori',canonicalName:'Villa Antinori',aliases:[],appellation:'Toscana'}]
    };
    const wines=[{id:'w1',producerId:'p-antinori',cuveeId:'c-villa',producer:'Antinori',wineName:'Villa Antinori',vintage:2020,appellation:'Toscana'}];
    expect(buildAchievementProgress(byId('super-tuscans'),registry,wines).completed).toBe(0);
    expect(buildAchievementProgress(byId('super-tuscans'),registry,
      [...wines,{id:'w2',producerId:'p-antinori',cuveeId:'c-tig',producer:'Antinori',wineName:'Tignanello',vintage:2019,appellation:'Toscana'}])
      .items.find(item=>item.label==='Tignanello')?.status).toBe('tasted');
  });

  it('explores Tuscany by the tier a bottle records',()=>{
    // The Chianti Classico UGAs would be the finer grain, but a bottle is
    // recorded as Chianti Classico - the place hierarchy has no UGAs - so a
    // UGA checklist could never tick. Appellations can.
    const result=buildAchievementProgress(byId('tuscany-appellations'),{producers:[],cuvees:[]},
      [{id:'w1',producer:'Fontodi',wineName:'Chianti Classico',vintage:2021,appellation:'Chianti Classico'}]);
    expect(result.items.find(item=>item.label==='Chianti Classico')?.status).toBe('tasted');
    expect(result.items.find(item=>item.label==='Brunello di Montalcino')?.status).not.toBe('tasted');
  });
});
