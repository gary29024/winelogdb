import { describe,expect,it } from 'vitest';
import { achievementDefinitions } from '../../src/features/achievements/curatedLaunch';
import { buildAchievementProgress } from '../../src/features/achievements/engine';
import type { AchievementIdentityRegistry,AchievementWine } from '../../src/features/achievements/types';

const climats=achievementDefinitions.find(definition=>definition.id==='chablis-seven-grand-cru-climats')!;

// The reported bottle: Domaine William Fevre, Chablis Grand Cru Bougros 2019.
// Recognition records the climat as the appellation - the detail page shows
// "APPELLATION Bougros" - because the climats are lieux-dits inside one AOC and
// the place hierarchy only knows "Chablis Grand Cru".
const bougros:AchievementWine={
  id:'w-bougros',producerId:'p-fevre',cuveeId:'c-bougros',producer:'Domaine William Fevre',
  wineName:'Chablis Grand Cru Bougros',vintage:2019,appellation:'Bougros'
};
const registry:AchievementIdentityRegistry={
  producers:[{id:'p-fevre',canonicalName:'Domaine William Fevre',aliases:['William Fevre']}],
  cuvees:[{id:'c-bougros',producerId:'p-fevre',canonicalName:'Chablis Grand Cru Bougros',aliases:['Bougros'],appellation:'Bougros'}]
};
const progress=(wines:AchievementWine[],identities=registry)=>buildAchievementProgress(climats,identities,wines);
const item=(wines:AchievementWine[],label:string,identities=registry)=>
  progress(wines,identities).items.find(entry=>entry.label===label)!;

describe('the seven Chablis Grand Cru climats',()=>{
  it('ticks a climat recorded under its own name',()=>{
    // This is what was reported: two climats tasted, the checklist showing
    // every one as NOT TASTED.
    expect(item([bougros],'Bougros').status).toBe('tasted');
    expect(progress([bougros]).completed).toBe(1);
  });

  it('ticks it when the appellation is written out in full instead',()=>{
    const spelled={...bougros,appellation:'Chablis Grand Cru'};
    const identities={...registry,cuvees:[{...registry.cuvees[0],appellation:'Chablis Grand Cru'}]};
    expect(item([spelled],'Bougros',identities).status).toBe('tasted');
  });

  it('still needs the climat named on the wine',()=>{
    // The appellation list is loose enough to accept "Chablis", so the cuvee
    // name is what keeps a village Chablis out of the checklist.
    const village:AchievementWine={id:'w-village',producerId:'p-fevre',cuveeId:'c-village',
      producer:'Domaine William Fevre',wineName:'Chablis',vintage:2022,appellation:'Chablis'};
    const identities:AchievementIdentityRegistry={...registry,
      cuvees:[{id:'c-village',producerId:'p-fevre',canonicalName:'Chablis',aliases:[],appellation:'Chablis'}]};
    expect(progress([village],identities).completed).toBe(0);
  });

  it('does not let one climat tick another',()=>{
    expect(item([bougros],'Les Clos').status).not.toBe('tasted');
    expect(item([bougros],'Valmur').status).not.toBe('tasted');
  });

  it('accepts an accented climat spelled either way',()=>{
    const vaudesir={...bougros,id:'w-vaudesir',cuveeId:'c-vaudesir',wineName:'Chablis Grand Cru Vaudesir',appellation:'Vaudesir'};
    const identities:AchievementIdentityRegistry={...registry,
      cuvees:[{id:'c-vaudesir',producerId:'p-fevre',canonicalName:'Chablis Grand Cru Vaudesir',aliases:[],appellation:'Vaudesir'}]};
    expect(item([vaudesir],'Vaudésir',identities).status).toBe('tasted');
  });
});
