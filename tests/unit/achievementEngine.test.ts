import { describe,expect,it } from 'vitest';
import { achievementDefinitions,getAchievementDefinition } from '../../src/features/achievements/definitions';
import { buildAchievementProgress,normalizeAchievementIdentity } from '../../src/features/achievements/engine';
import type { AchievementDefinition,AchievementIdentityRegistry,AchievementWine } from '../../src/features/achievements/types';

const registry:AchievementIdentityRegistry={
  producers:[
    {id:'p-lafite',canonicalName:'Château Lafite Rothschild',aliases:['Chateau Lafite Rothschild']},
    {id:'p-ridge',canonicalName:'Ridge Vineyards',aliases:['Ridge']},
    {id:'p-drouhin',canonicalName:'Maison Joseph Drouhin',aliases:['Joseph Drouhin']}
  ],
  cuvees:[
    {id:'c-monte-bello',producerId:'p-ridge',canonicalName:'Monte Bello',aliases:['Monte Bello Cabernet Sauvignon'],appellation:'Santa Cruz Mountains'},
    {id:'c-clos-mouches',producerId:'p-drouhin',canonicalName:'Beaune 1er Cru Clos des Mouches',aliases:['Beaune Clos des Mouches'],appellation:'Beaune Premier Cru'}
  ]
};

const wines:AchievementWine[]=[
  {id:'w-lafite',producerId:'p-lafite',cuveeId:'c-lafite-grand-vin',producer:'Château Lafite Rothschild',wineName:'Château Lafite Rothschild',vintage:2010,appellation:'Pauillac'},
  {id:'w-ridge-1971',producerId:'p-ridge',cuveeId:'c-monte-bello',producer:'Ridge Vineyards',wineName:'Monte Bello',vintage:1971,appellation:'Santa Cruz Mountains'},
  {id:'w-drouhin-1973',producerId:'p-drouhin',cuveeId:'c-clos-mouches',producer:'Joseph Drouhin',wineName:'Beaune Clos des Mouches',vintage:1973,appellation:'Beaune 1er Cru'},
  {id:'w-morgon',producerId:'p-foillard',cuveeId:'c-cote-py',producer:'Jean Foillard',wineName:'Côte du Py',vintage:2022,appellation:'Morgon'}
];

function oneItem(selector:AchievementDefinition['items'][number]['selector']):AchievementDefinition{return {
  id:'test',title:'Test',subtitle:'Test',category:'historic-tastings',icon:'judgment-paris',references:[],items:[{id:'one',label:'One',selector}]
}}

describe('achievement engine',()=>{
  it('normalizes accents, punctuation and spacing deterministically',()=>{
    expect(normalizeAchievementIdentity('  Château Léoville-Las-Cases  ')).toBe('chateau leoville las cases');
    expect(normalizeAchievementIdentity("Stag’s Leap & Co.")).toBe('stags leap and co');
  });

  it('counts producer achievements only through a resolved stable producer identity',()=>{
    const result=buildAchievementProgress(oneItem({type:'producer',producerNames:['Chateau Lafite Rothschild']}),registry,wines);
    expect(result.completed).toBe(1);
    expect(result.items[0]).toMatchObject({status:'tasted',resolvedProducerId:'p-lafite',tastedWineIds:['w-lafite']});
  });

  it('requires the exact vintage for historic wine-vintage achievements',()=>{
    const selector={type:'wine_vintage' as const,producerNames:['Ridge'],cuveeNames:['Monte Bello Cabernet Sauvignon'],vintage:1971};
    const hit=buildAchievementProgress(oneItem(selector),registry,wines);
    const miss=buildAchievementProgress(oneItem({...selector,vintage:1972}),registry,wines);
    expect(hit.items[0]).toMatchObject({status:'tasted',resolvedProducerId:'p-ridge',resolvedCuveeId:'c-monte-bello'});
    expect(miss.items[0].status).toBe('pending');
  });

  it('uses known producer and cuvee aliases to bind a target to stable ids',()=>{
    const result=buildAchievementProgress(oneItem({type:'wine_vintage',producerNames:['Joseph Drouhin'],cuveeNames:['Beaune Clos des Mouches'],vintage:1973}),registry,wines);
    expect(result.items[0]).toMatchObject({status:'tasted',resolvedProducerId:'p-drouhin',resolvedCuveeId:'c-clos-mouches'});
  });

  it('marks an unlinked raw-name match as possible instead of falsely completed',()=>{
    const unlinked:AchievementWine={id:'legacy',producer:'Chateau Montelena',wineName:'Chardonnay',vintage:1973,appellation:'Napa Valley'};
    const result=buildAchievementProgress(oneItem({type:'wine_vintage',producerNames:['Chateau Montelena'],cuveeNames:['Chardonnay'],vintage:1973}),{producers:[],cuvees:[]},[unlinked]);
    expect(result).toMatchObject({completed:0,possible:1,pending:0,percent:0,complete:false});
    expect(result.items[0]).toMatchObject({status:'possible',tastedWineIds:['legacy']});
  });

  it('counts appellation collections without requiring a producer or cuvee identity',()=>{
    const result=buildAchievementProgress(oneItem({type:'appellation',appellationNames:['Morgon']}),registry,wines);
    expect(result.items[0]).toMatchObject({status:'tasted',tastedWineIds:['w-morgon'],tastedVintages:[2022]});
  });

  it('does not treat ambiguous producer aliases as a confirmed identity',()=>{
    const ambiguous:AchievementIdentityRegistry={producers:[{id:'a',canonicalName:'Estate A',aliases:['Shared Name']},{id:'b',canonicalName:'Estate B',aliases:['Shared Name']}],cuvees:[]};
    const linked:AchievementWine={id:'w',producerId:'a',producer:'Estate A',wineName:'Wine',vintage:2020};
    const result=buildAchievementProgress(oneItem({type:'producer',producerNames:['Shared Name']}),ambiguous,[linked]);
    expect(result.items[0].status).toBe('pending');
    expect(result.items[0].resolvedProducerId).toBeUndefined();
  });
});

describe('starter achievement definitions',()=>{
  it('ships the three curated starter collections with stable item counts',()=>{
    expect(achievementDefinitions.map(item=>[item.id,item.items.length])).toEqual([
      ['bordeaux-first-growths',5],
      ['judgment-of-paris-1976',20],
      ['beaujolais-ten-crus',10]
    ]);
  });

  it('keeps curation references attached to each collection',()=>{
    for(const definition of achievementDefinitions){
      expect(definition.references.length).toBeGreaterThan(0);
      expect(definition.references.every(reference=>reference.url.startsWith('https://'))).toBe(true);
    }
    expect(getAchievementDefinition('judgment-of-paris-1976')?.items.some(item=>item.id==='ridge-monte-bello-1971')).toBe(true);
  });
});
