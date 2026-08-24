import { describe,expect,it } from 'vitest';
import { achievementDefinitions,getAchievementDefinition } from '../../src/features/achievements/curatedLaunch';
import { buildAchievementProgress } from '../../src/features/achievements/engine';
import type { AchievementIdentityRegistry,AchievementWine } from '../../src/features/achievements/types';

const registry:AchievementIdentityRegistry={
  producers:[
    {id:'p-yquem',canonicalName:'Château d’Yquem',aliases:["Chateau d'Yquem"]},
    {id:'p-lafite',canonicalName:'Château Lafite Rothschild',aliases:['Chateau Lafite Rothschild']},
    {id:'p-dujac',canonicalName:'Domaine Dujac',aliases:['Dujac']}
  ],
  cuvees:[
    {id:'c-yquem',producerId:'p-yquem',canonicalName:'Château d’Yquem',aliases:["Chateau d'Yquem"],appellation:'Sauternes'},
    {id:'c-y',producerId:'p-yquem',canonicalName:'Y d’Yquem',aliases:["Y d'Yquem"],appellation:'Bordeaux Blanc'},
    {id:'c-lafite',producerId:'p-lafite',canonicalName:'Château Lafite Rothschild',aliases:['Chateau Lafite Rothschild'],appellation:'Pauillac'},
    {id:'c-carruades',producerId:'p-lafite',canonicalName:'Carruades de Lafite',appellation:'Pauillac'}
  ]
};

const yWine:AchievementWine={id:'w-y',producerId:'p-yquem',cuveeId:'c-y',producer:'Château d’Yquem',wineName:'Y d’Yquem',vintage:2021,appellation:'Bordeaux Blanc'};
const yquemWine:AchievementWine={id:'w-yquem',producerId:'p-yquem',cuveeId:'c-yquem',producer:'Château d’Yquem',wineName:'Château d’Yquem',vintage:2015,appellation:'Sauternes'};
const carruades:AchievementWine={id:'w-carruades',producerId:'p-lafite',cuveeId:'c-carruades',producer:'Château Lafite Rothschild',wineName:'Carruades de Lafite',vintage:2019,appellation:'Pauillac'};
const lafite:AchievementWine={id:'w-lafite',producerId:'p-lafite',cuveeId:'c-lafite',producer:'Château Lafite Rothschild',wineName:'Château Lafite Rothschild',vintage:2019,appellation:'Pauillac'};

describe('classified wine achievement semantics',()=>{
  it('does not award Château d’Yquem after tasting only Y d’Yquem',()=>{
    const definition=getAchievementDefinition('sauternes-barsac-top-1855');expect(definition).not.toBeNull();
    const onlyY=buildAchievementProgress(definition!,registry,[yWine]);
    expect(onlyY.items.find(item=>item.label==='Château d’Yquem')).toMatchObject({status:'pending',tastedWineIds:[]});

    const withGrandVin=buildAchievementProgress(definition!,registry,[yWine,yquemWine]);
    expect(withGrandVin.items.find(item=>item.label==='Château d’Yquem')).toMatchObject({status:'tasted',tastedWineIds:['w-yquem'],resolvedCuveeId:'c-yquem'});
  });

  it('does not award a Bordeaux First Growth from its second wine',()=>{
    const definition=getAchievementDefinition('bordeaux-first-growths');expect(definition).not.toBeNull();
    const onlySecondWine=buildAchievementProgress(definition!,registry,[carruades]);
    expect(onlySecondWine.items.find(item=>item.label==='Château Lafite Rothschild')).toMatchObject({status:'pending',tastedWineIds:[]});

    const withGrandVin=buildAchievementProgress(definition!,registry,[carruades,lafite]);
    expect(withGrandVin.items.find(item=>item.label==='Château Lafite Rothschild')).toMatchObject({status:'tasted',tastedWineIds:['w-lafite'],resolvedCuveeId:'c-lafite'});
  });

  it('keeps estate-guide collections producer based',()=>{
    const michelin=achievementDefinitions.find(definition=>definition.id==='michelin-grapes-burgundy-2026-two');expect(michelin).toBeDefined();
    expect(michelin!.items.find(item=>item.label==='Dujac')?.selector.type).toBe('producer');
  });
});
