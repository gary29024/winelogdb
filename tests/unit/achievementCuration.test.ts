import { describe,expect,it } from 'vitest';
import { achievementChecklistHeading } from '../../src/features/achievements/collectionSections';
import { achievementDefinitions } from '../../src/features/achievements/curatedLaunch';
import { buildAchievementProgress } from '../../src/features/achievements/engine';
import type { AchievementDefinition,AchievementIdentityRegistry,AchievementWine } from '../../src/features/achievements/types';

const registry:AchievementIdentityRegistry={
  producers:[
    {id:'ridge',canonicalName:'Ridge Vineyards',aliases:['Ridge']},
    {id:'other',canonicalName:'Other Producer'},
    {id:'chablis-producer',canonicalName:'Domaine Test Chablis'}
  ],
  cuvees:[
    {id:'monte-bello',producerId:'ridge',canonicalName:'Monte Bello',aliases:['Monte Bello Cabernet Sauvignon'],appellation:'Santa Cruz Mountains'},
    {id:'ridge-zin',producerId:'ridge',canonicalName:'Geyserville',appellation:'Alexander Valley'},
    {id:'les-clos',producerId:'chablis-producer',canonicalName:'Les Clos',aliases:['Chablis Grand Cru Les Clos'],appellation:'Chablis Grand Cru'}
  ]
};
const wines:AchievementWine[]=[
  {id:'ridge-2021',producerId:'ridge',cuveeId:'monte-bello',producer:'Ridge Vineyards',wineName:'Monte Bello',vintage:2021,appellation:'Santa Cruz Mountains'},
  {id:'ridge-zin-2022',producerId:'ridge',cuveeId:'ridge-zin',producer:'Ridge Vineyards',wineName:'Geyserville',vintage:2022,appellation:'Alexander Valley'},
  {id:'les-clos-2020',producerId:'chablis-producer',cuveeId:'les-clos',producer:'Domaine Test Chablis',wineName:'Les Clos',vintage:2020,appellation:'Chablis Grand Cru'}
];
const historic:AchievementDefinition={
  id:'historic',title:'Historic',subtitle:'Historic',category:'historic-tastings',icon:'judgment-paris',references:[],items:[{
    id:'ridge-1971',label:'Ridge Monte Bello 1971',selector:{type:'wine_vintage',producerNames:['Ridge Vineyards','Ridge'],cuveeNames:['Monte Bello'],vintage:1971}
  }]
};

describe('curated achievement launch set',()=>{
  it('keeps the curated set intact while replacing the five overlapping French cards',()=>{
    // No fixed size - the curated set is meant to grow - but the five cards
    // these replaced must stay gone.
    expect(achievementDefinitions.length).toBeGreaterThanOrEqual(25);
    const ids=new Set(achievementDefinitions.map(item=>item.id));
    for(const removed of ['bordeaux-second-growths','sauternes-barsac-second-growths','cote-de-nuits-24-grand-crus','cote-de-beaune-8-grand-crus','gevrey-nine-grand-crus'])expect(ids.has(removed)).toBe(false);
    expect(achievementDefinitions.find(item=>item.id==='chablis-seven-grand-cru-climats')?.items).toHaveLength(7);
    expect(achievementDefinitions.find(item=>item.id==='australia-first-families')?.items).toHaveLength(12);
    expect(achievementDefinitions.find(item=>item.id==='new-zealand-family-of-twelve')?.items).toHaveLength(12);
    expect(achievementDefinitions.find(item=>item.id==='italy-istituto-grandi-marchi')?.items).toHaveLength(18);
    expect(achievementDefinitions.find(item=>item.id==='amarone-famiglie-storiche')?.items).toHaveLength(13);
  });

  it('matches Chablis Grand Cru climats through canonical cuvee identity across producers',()=>{
    const definition=achievementDefinitions.find(item=>item.id==='chablis-seven-grand-cru-climats');expect(definition).toBeDefined();
    const result=buildAchievementProgress(definition!,registry,wines);
    expect(result.items.find(item=>item.label==='Les Clos')).toMatchObject({status:'tasted',tastedWineIds:['les-clos-2020']});
  });
});

describe('historic collection counting modes',()=>{
  it('keeps exact vintage matching as the default',()=>{
    const result=buildAchievementProgress(historic,registry,wines);
    expect(result).toMatchObject({completed:0,matchMode:'exact',supportsRelaxedMatching:true});
  });

  it('can relax only the vintage while retaining the same cuvee',()=>{
    const result=buildAchievementProgress(historic,registry,wines,'cuvee');
    expect(result).toMatchObject({completed:1,matchMode:'cuvee'});
    expect(result.items[0]).toMatchObject({status:'tasted',tastedWineIds:['ridge-2021']});
  });

  it('can relax to any wine from the participating producer',()=>{
    const withoutMonteBello=wines.filter(wine=>wine.id!=='ridge-2021');
    const result=buildAchievementProgress(historic,registry,withoutMonteBello,'producer');
    expect(result).toMatchObject({completed:1,matchMode:'producer'});
    expect(result.items[0]).toMatchObject({status:'tasted',tastedWineIds:['ridge-zin-2022']});
  });
});

describe('master checklist section headings',()=>{
  const load=async()=>(await import('../../src/features/achievements/curatedLaunch')).achievementDefinitions;
  const headingsOf=async(id:string)=>{
    const collection=(await load()).find(definition=>definition.id===id)!;
    return collection.items.map(item=>({label:item.label,...achievementChecklistHeading(id,item.id)}));
  };
  const under=async(id:string,section:string,subsection?:string)=>
    (await headingsOf(id)).filter(row=>row.section===section&&(subsection===undefined||row.subsection===subsection)).map(row=>row.label);

  it('names a heading from the wine, not from where it sits in the list',async()=>{
    // The bug this replaces. Checklists are served from a per-owner cache that
    // can be a release behind, so a heading chosen by position was laid over a
    // stale order and put Château Pape Clément under "Classified for white",
    // which it is not. A stale order may now group the page untidily; it can no
    // longer make a false claim about a wine.
    const graves=(await load()).find(definition=>definition.id==='graves-crus-classes')!;
    const pape=graves.items.find(item=>item.label.includes('Pape Clément'))!;
    expect(achievementChecklistHeading('graves-crus-classes',pape.id).section).toBe('Classified for red');
    // and the answer does not depend on the collection's order at all
    expect(achievementChecklistHeading('graves-crus-classes','graves-chateau-couhins').section).toBe('Classified for white');
  });

  it('gives every item in every divided collection a heading',async()=>{
    // The strong guard. A list and its headings are built from the same arrays,
    // so an estate added, renamed or moved without a matching heading shows up
    // here rather than as a silent gap on the page.
    const { checklistHeadings }=await import('../../src/features/achievements/expandedDefinitions');
    for(const id of Object.keys(checklistHeadings)){
      const rows=await headingsOf(id);
      expect(rows.length,`${id} exists and has items`).toBeGreaterThan(0);
      const missing=rows.filter(row=>!row.section).map(row=>row.label);
      expect(missing,`${id} has an item with no heading`).toEqual([]);
      // no heading entry may go unused either, which is how a typo shows itself
      expect(Object.keys(checklistHeadings[id]).length,`${id} has an unused heading entry`).toBe(rows.length);
    }
  });

  it('splits the 1855 reds into their five growths',async()=>{
    expect(await under('bordeaux-1855-red-classified-growths','First Growths · Premiers Crus')).toHaveLength(5);
    expect(await under('bordeaux-1855-red-classified-growths','Second Growths · Deuxièmes Crus')).toHaveLength(14);
    expect(await under('bordeaux-1855-red-classified-growths','Third Growths · Troisièmes Crus')).toHaveLength(14);
    expect(await under('bordeaux-1855-red-classified-growths','Fourth Growths · Quatrièmes Crus')).toHaveLength(10);
    expect(await under('bordeaux-1855-red-classified-growths','Fifth Growths · Cinquièmes Crus')).toHaveLength(18);
    expect(await under('bordeaux-1855-red-classified-growths','First Growths · Premiers Crus')).toContain('Château Haut-Brion');
  });

  it('splits the 1855 sweets by growth, with Yquem on its own',async()=>{
    expect(await under('sauternes-barsac-1855-all','Superior First Growth · Premier Cru Supérieur')).toEqual(['Château d’Yquem']);
    expect(await under('sauternes-barsac-1855-all','First Growths · Premiers Crus')).toHaveLength(11);
    expect(await under('sauternes-barsac-1855-all','Second Growths · Seconds Crus')).toHaveLength(15);
    // the Top Growths collection spans two of those ranks and reads the same way
    expect(await under('sauternes-barsac-top-1855','Superior First Growth · Premier Cru Supérieur')).toEqual(['Château d’Yquem']);
    expect(await under('sauternes-barsac-top-1855','First Growths · Premiers Crus')).toHaveLength(11);
  });

  it('splits Graves by what each estate is classified for, which is its only division',async()=>{
    // Twelve classified for red and eight for white, against the thirteen and
    // nine of 1959 - the difference is exactly La Tour Haut-Brion and Laville
    // Haut-Brion, both since absorbed into Château La Mission Haut-Brion.
    const both=await under('graves-crus-classes','Classified for red and white');
    const redOnly=await under('graves-crus-classes','Classified for red');
    const whiteOnly=await under('graves-crus-classes','Classified for white');
    expect(both).toHaveLength(6);
    expect(redOnly).toHaveLength(6);
    expect(whiteOnly).toEqual(['Château Couhins','Château Couhins-Lurton']);
    expect(both.length+redOnly.length,'classified for red').toBe(12);
    expect(both.length+whiteOnly.length,'classified for white').toBe(8);
    expect(redOnly).toContain('Château Haut-Brion');
    expect(both).toContain('Domaine de Chevalier');
  });

  it('splits the Saint-Émilion Premiers into A and B',async()=>{
    // The gap between them is what the 2022 classification is remembered for.
    expect(await under('saint-emilion-2022-premiers','Premier Grand Cru Classé A')).toEqual(['Château Figeac','Château Pavie']);
    expect(await under('saint-emilion-2022-premiers','Premier Grand Cru Classé B')).toHaveLength(12);
  });

  it('splits Burgundy Grand Crus by Chablis, Côte de Nuits communes and Côte de Beaune hills',async()=>{
    expect(await under('burgundy-33-grand-crus','Chablis')).toEqual(['Chablis Grand Cru']);
    expect(await under('burgundy-33-grand-crus','Côte de Nuits','Gevrey-Chambertin')).toHaveLength(9);
    expect(await under('burgundy-33-grand-crus','Côte de Nuits','Morey-Saint-Denis')).toHaveLength(4);
    expect(await under('burgundy-33-grand-crus','Côte de Nuits','Chambolle-Musigny / Morey-Saint-Denis'),
      'Bonnes-Mares straddles the two communes').toEqual(['Bonnes-Mares']);
    expect(await under('burgundy-33-grand-crus','Côte de Nuits','Vosne-Romanée / Flagey-Échezeaux')).toHaveLength(8);
    expect(await under('burgundy-33-grand-crus','Côte de Beaune')).toHaveLength(8);
  });

  it('keeps every reordered collection at the size it always was',async()=>{
    // Reordering by rank must not quietly drop or duplicate an estate, and the
    // item ids are built from the labels, so progress already recorded against
    // them survives the move.
    const all=await load();
    for(const [id,size] of [['graves-crus-classes',14],['saint-emilion-2022-premiers',14],['sauternes-barsac-top-1855',12]] as const){
      const items=all.find(definition=>definition.id===id)!.items;
      expect(items,id).toHaveLength(size);
      expect(new Set(items.map(item=>item.id)).size,`${id} has no duplicates`).toBe(size);
    }
  });
});
