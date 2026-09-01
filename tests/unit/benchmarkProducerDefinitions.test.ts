import { describe,expect,it } from 'vitest';
import { benchmarkProducerDefinition } from '../../src/features/achievements/benchmarkProducerDefinitions';
import { achievementChecklistHeading } from '../../src/features/achievements/collectionSections';
import { buildAchievementProgress } from '../../src/features/achievements/engine';

const labels=()=>benchmarkProducerDefinition.items.map(item=>item.label);
const item=(label:string)=>{
  const found=benchmarkProducerDefinition.items.find(entry=>entry.label===label);
  if(!found)throw new Error(`Missing benchmark producer ${label}`);
  return found;
};

describe('the world benchmark producer collection',()=>{
  it('is one card with 134 unique producer targets from the course lists',()=>{
    expect(benchmarkProducerDefinition.id).toBe('world-benchmark-producers');
    expect(benchmarkProducerDefinition.items).toHaveLength(134);
    expect(new Set(benchmarkProducerDefinition.items.map(entry=>entry.id)).size).toBe(134);
    expect(new Set(labels()).size).toBe(134);
    expect(benchmarkProducerDefinition.items.every(entry=>entry.selector.type==='producer')).toBe(true);
  });

  it('keeps regional series inside that card instead of creating more cards',()=>{
    expect(achievementChecklistHeading(benchmarkProducerDefinition.id,item('Edmond Vatan').id)).toEqual({section:'France',subsection:'Loire'});
    expect(achievementChecklistHeading(benchmarkProducerDefinition.id,item('E. Guigal').id)).toEqual({section:'France',subsection:'Northern Rhône'});
    expect(achievementChecklistHeading(benchmarkProducerDefinition.id,item('Giuseppe Rinaldi').id)).toEqual({section:'Italy',subsection:'Barolo'});
    expect(achievementChecklistHeading(benchmarkProducerDefinition.id,item('Harlan Estate').id)).toEqual({section:'United States',subsection:'Napa Valley'});
    expect(achievementChecklistHeading(benchmarkProducerDefinition.id,item('Domaine Serene').id)).toEqual({section:'United States',subsection:'Oregon Pinot Noir'});
    expect(achievementChecklistHeading(benchmarkProducerDefinition.id,item('Kanonkop').id)).toEqual({section:'South Africa',subsection:null});
  });

  it('deduplicates producers that appeared in several course slides and preserves those contexts',()=>{
    for(const label of ['Keller','E. Guigal','Dog Point','Giant Steps','By Farr'])expect(labels().filter(value=>value===label)).toHaveLength(1);
    expect(item('Keller').note).toBe('Riesling · Spätburgunder');
    expect(item('E. Guigal').note).toBe('Condrieu · Côte-Rôtie · Saint-Joseph');
    expect(item('Dog Point').note).toBe('Chardonnay · Pinot Noir');
    expect(item('Giant Steps').note).toBe('Chardonnay · Pinot Noir');
  });

  it('matches a course target through an existing canonical producer identity',()=>{
    const result=buildAchievementProgress(
      {...benchmarkProducerDefinition,items:[item('Keller')]},
      {producers:[{id:'p-keller',canonicalName:'Weingut Keller'}],cuvees:[]},
      [{id:'w-keller',producerId:'p-keller',producer:'Keller',wineName:'Hubacker Riesling',vintage:2021}]
    );
    expect(result).toMatchObject({completed:1,total:1,items:[{status:'tasted',resolvedProducerId:'p-keller'}]});
  });
});
