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

  it('will not tick a climat from a wine that merely mentions it',()=>{
    // The question this answers: the appellation list is loose, so does the
    // collection start catching lieux-dits elsewhere? It does not - both the
    // cuvee name and the appellation are matched whole, never as substrings.
    const elsewhere:AchievementWine[]=[
      // A Chablis Premier Cru whose climat happens to share a word.
      {id:'w-1er',producerId:'p-fevre',cuveeId:'c-1er',producer:'Domaine William Fevre',
        wineName:'Chablis 1er Cru Montée de Tonnerre',vintage:2020,appellation:'Chablis Premier Cru'},
      // Chassagne has a Blanchot Dessus; it is not the Chablis Blanchot.
      {id:'w-blanchot-dessus',producerId:'p-other',cuveeId:'c-bd',producer:'Domaine Elsewhere',
        wineName:'Chassagne-Montrachet 1er Cru Blanchot Dessus',vintage:2019,appellation:'Chassagne-Montrachet'},
      // A Loire wine called Les Clos - a name used up and down France.
      {id:'w-sancerre',producerId:'p-loire',cuveeId:'c-clos',producer:'Domaine Loire',
        wineName:'Les Clos',vintage:2022,appellation:'Sancerre'}
    ];
    const identities:AchievementIdentityRegistry={
      producers:[...registry.producers,{id:'p-other',canonicalName:'Domaine Elsewhere',aliases:[]},{id:'p-loire',canonicalName:'Domaine Loire',aliases:[]}],
      cuvees:[
        {id:'c-1er',producerId:'p-fevre',canonicalName:'Chablis 1er Cru Montée de Tonnerre',aliases:[],appellation:'Chablis Premier Cru'},
        {id:'c-bd',producerId:'p-other',canonicalName:'Chassagne-Montrachet 1er Cru Blanchot Dessus',aliases:[],appellation:'Chassagne-Montrachet'},
        {id:'c-clos',producerId:'p-loire',canonicalName:'Les Clos',aliases:[],appellation:'Sancerre'}
      ]
    };
    expect(progress(elsewhere,identities).completed).toBe(0);
  });

  it('needs the appellation to be a Chablis one even when the name fits',()=>{
    // "Les Clos" on its own is only a Chablis Grand Cru if the appellation says
    // so; from anywhere else it is a different vineyard with the same name.
    const strayLesClos:AchievementWine={id:'w-stray',producerId:'p-loire',cuveeId:'c-stray',
      producer:'Domaine Loire',wineName:'Les Clos',vintage:2021,appellation:'Chinon'};
    const identities:AchievementIdentityRegistry={
      producers:[{id:'p-loire',canonicalName:'Domaine Loire',aliases:[]}],
      cuvees:[{id:'c-stray',producerId:'p-loire',canonicalName:'Les Clos',aliases:[],appellation:'Chinon'}]
    };
    expect(progress([strayLesClos],identities).completed).toBe(0);
  });
});
