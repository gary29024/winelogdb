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
  it('splits Bordeaux 1855 by growth',()=>{
    expect(achievementChecklistHeading('bordeaux-1855-red-classified-growths',0).section).toContain('First');
    expect(achievementChecklistHeading('bordeaux-1855-red-classified-growths',5).section).toContain('Second');
    expect(achievementChecklistHeading('bordeaux-1855-red-classified-growths',19).section).toContain('Third');
    expect(achievementChecklistHeading('bordeaux-1855-red-classified-growths',33).section).toContain('Fourth');
    expect(achievementChecklistHeading('bordeaux-1855-red-classified-growths',43).section).toContain('Fifth');
  });

  it('splits Sauternes & Barsac 1855 by growth, with Yquem on its own',()=>{
    // Twenty-seven estates in one undifferentiated list reads as a wall. The
    // reds have been split by growth since launch; the sweets are the same
    // classification and were not.
    expect(achievementChecklistHeading('sauternes-barsac-1855-all',0).section).toContain('Premier Cru Supérieur');
    expect(achievementChecklistHeading('sauternes-barsac-1855-all',1).section).toContain('First Growths');
    expect(achievementChecklistHeading('sauternes-barsac-1855-all',11).section).toContain('First Growths');
    expect(achievementChecklistHeading('sauternes-barsac-1855-all',12).section).toContain('Second Growths');
    expect(achievementChecklistHeading('sauternes-barsac-1855-all',26).section).toContain('Second Growths');
  });

  it('splits the Top Growths collection at Yquem too, since it spans two ranks',()=>{
    expect(achievementChecklistHeading('sauternes-barsac-top-1855',0).section).toContain('Premier Cru Supérieur');
    expect(achievementChecklistHeading('sauternes-barsac-top-1855',1).section).toContain('First Growths');
  });

  it('puts every 1855 sweet estate under the heading its rank belongs to',async()=>{
    // The boundaries are indexes into a hand-written list, so they are checked
    // against the list itself rather than trusted: a growth added or reordered
    // upstream would otherwise silently file estates under the wrong rank.
    const { achievementDefinitions:all }=await import('../../src/features/achievements/curatedLaunch');
    const collection=all.find(definition=>definition.id==='sauternes-barsac-1855-all')!;
    expect(collection.items).toHaveLength(27);
    expect(collection.items[0].label).toContain('Yquem');
    const heads=collection.items.map((_,index)=>achievementChecklistHeading('sauternes-barsac-1855-all',index).section);
    expect(heads.filter(head=>head?.includes('Supérieur'))).toHaveLength(1);
    expect(heads.filter(head=>head?.includes('First Growths'))).toHaveLength(11);
    expect(heads.filter(head=>head?.includes('Second Growths'))).toHaveLength(15);
  });

  it('splits Graves by what each estate is classified for, which is its only division',()=>{
    expect(achievementChecklistHeading('graves-crus-classes',0).section).toBe('Classified for red and white');
    expect(achievementChecklistHeading('graves-crus-classes',5).section).toBe('Classified for red and white');
    expect(achievementChecklistHeading('graves-crus-classes',6).section).toBe('Classified for red');
    expect(achievementChecklistHeading('graves-crus-classes',11).section).toBe('Classified for red');
    expect(achievementChecklistHeading('graves-crus-classes',12).section).toBe('Classified for white');
  });

  it('splits the Saint-Émilion Premiers into A and B',()=>{
    // The gap between them is what the 2022 classification is remembered for.
    expect(achievementChecklistHeading('saint-emilion-2022-premiers',0).section).toBe('Premier Grand Cru Classé A');
    expect(achievementChecklistHeading('saint-emilion-2022-premiers',1).section).toBe('Premier Grand Cru Classé A');
    expect(achievementChecklistHeading('saint-emilion-2022-premiers',2).section).toBe('Premier Grand Cru Classé B');
  });

  it('files each Graves and Saint-Émilion estate under the right heading',async()=>{
    // Same guard as the 1855 sweets: the boundaries are indexes into
    // hand-written lists, so they are checked against the lists themselves.
    const { achievementDefinitions:all }=await import('../../src/features/achievements/curatedLaunch');
    const labelsUnder=(id:string,section:string)=>{
      const collection=all.find(definition=>definition.id===id)!;
      return collection.items.filter((_,index)=>achievementChecklistHeading(id,index).section===section).map(item=>item.label);
    };
    expect(labelsUnder('saint-emilion-2022-premiers','Premier Grand Cru Classé A'))
      .toEqual(['Château Figeac','Château Pavie']);
    expect(labelsUnder('saint-emilion-2022-premiers','Premier Grand Cru Classé B')).toHaveLength(12);

    // Twelve classified for red and eight for white, against the thirteen and
    // nine of 1959 - the difference is exactly La Tour Haut-Brion and Laville
    // Haut-Brion, both since absorbed into Château La Mission Haut-Brion.
    const both=labelsUnder('graves-crus-classes','Classified for red and white');
    const redOnly=labelsUnder('graves-crus-classes','Classified for red');
    const whiteOnly=labelsUnder('graves-crus-classes','Classified for white');
    expect(both).toHaveLength(6);
    expect(redOnly).toHaveLength(6);
    expect(whiteOnly).toEqual(['Château Couhins','Château Couhins-Lurton']);
    expect(both.length+redOnly.length,'classified for red').toBe(12);
    expect(both.length+whiteOnly.length,'classified for white').toBe(8);
    expect(redOnly).toContain('Château Haut-Brion');
    expect(both).toContain('Domaine de Chevalier');
  });

  it('keeps every reordered collection at the size it always was',async()=>{
    // Reordering by rank must not quietly drop or duplicate an estate, and the
    // item ids are built from the labels, so progress already recorded against
    // them survives the move.
    const { achievementDefinitions:all }=await import('../../src/features/achievements/curatedLaunch');
    for(const [id,size] of [['graves-crus-classes',14],['saint-emilion-2022-premiers',14]] as const){
      const items=all.find(definition=>definition.id===id)!.items;
      expect(items,id).toHaveLength(size);
      expect(new Set(items.map(item=>item.id)).size,`${id} has no duplicates`).toBe(size);
    }
  });

  it('splits Burgundy Grand Crus by Chablis, Côte de Nuits communes and Côte de Beaune hills',()=>{
    expect(achievementChecklistHeading('burgundy-33-grand-crus',0)).toMatchObject({section:'Chablis'});
    expect(achievementChecklistHeading('burgundy-33-grand-crus',1)).toMatchObject({section:'Côte de Nuits',subsection:'Gevrey-Chambertin'});
    expect(achievementChecklistHeading('burgundy-33-grand-crus',10)).toMatchObject({section:'Côte de Nuits',subsection:'Morey-Saint-Denis'});
    expect(achievementChecklistHeading('burgundy-33-grand-crus',25).section).toBe('Côte de Beaune');
    expect(achievementChecklistHeading('burgundy-33-grand-crus',28).subsection).toContain('Montrachet');
  });
});
