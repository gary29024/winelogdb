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
