import { describe,expect,it } from 'vitest';
import { benchmarkCourseDefinition } from '../../src/features/achievements/benchmarkCourseDefinition';
import { achievementChecklistHeading } from '../../src/features/achievements/collectionSections';
import { buildAchievementProgress } from '../../src/features/achievements/engine';

const labels=()=>benchmarkCourseDefinition.items.map(item=>item.label);
const item=(label:string)=>{
  const found=benchmarkCourseDefinition.items.find(entry=>entry.label===label);
  if(!found)throw new Error(`Missing course benchmark ${label}`);
  return found;
};

describe('the world benchmark producer and cuvee collection',()=>{
  it('stays one card while expanding explicitly named wines into their own targets',()=>{
    expect(benchmarkCourseDefinition.id).toBe('world-benchmark-producers');
    expect(benchmarkCourseDefinition.title).toBe('World Benchmark Producers & Cuvées');
    expect(benchmarkCourseDefinition.items).toHaveLength(142);
    expect(new Set(benchmarkCourseDefinition.items.map(entry=>entry.id)).size).toBe(142);
    expect(new Set(labels()).size).toBe(142);
    expect(item('Keller').selector.type).toBe('producer');
    expect(item('E. Guigal — La Turque').selector.type).toBe('cuvee');
    expect(item('Tenuta San Guido — Sassicaia').selector.type).toBe('cuvee');
    expect(item('Penfolds — Yattarna').selector.type).toBe('cuvee');
  });

  it('keeps regional series inside that one card, including finer headings for named Rhone wines',()=>{
    expect(achievementChecklistHeading(benchmarkCourseDefinition.id,item('Edmond Vatan — Clos la Néore').id)).toEqual({section:'France',subsection:'Loire'});
    expect(achievementChecklistHeading(benchmarkCourseDefinition.id,item('E. Guigal — La Doriane').id)).toEqual({section:'France',subsection:'Condrieu'});
    expect(achievementChecklistHeading(benchmarkCourseDefinition.id,item('E. Guigal — La Turque').id)).toEqual({section:'France',subsection:'Côte-Rôtie'});
    expect(achievementChecklistHeading(benchmarkCourseDefinition.id,item("E. Guigal — Vignes de l'Hospice").id)).toEqual({section:'France',subsection:'Saint-Joseph'});
    expect(achievementChecklistHeading(benchmarkCourseDefinition.id,item('Giuseppe Rinaldi').id)).toEqual({section:'Italy',subsection:'Barolo'});
    expect(achievementChecklistHeading(benchmarkCourseDefinition.id,item('Harlan Estate').id)).toEqual({section:'United States',subsection:'Napa Valley'});
    expect(achievementChecklistHeading(benchmarkCourseDefinition.id,item('Domaine Serene').id)).toEqual({section:'United States',subsection:'Oregon Pinot Noir'});
  });

  it('deduplicates producer-only repeats but does not collapse genuinely different named cuvees',()=>{
    for(const label of ['Keller','Dog Point','Giant Steps','By Farr'])expect(labels().filter(value=>value===label)).toHaveLength(1);
    expect(labels()).not.toContain('E. Guigal');
    expect(labels().filter(value=>value.startsWith('E. Guigal — '))).toHaveLength(6);
    expect(item('Keller').note).toBe('Riesling · Spätburgunder');
    expect(item('Dog Point').note).toBe('Chardonnay · Pinot Noir');
  });

  it('still matches producer-only targets through canonical producer identity',()=>{
    const result=buildAchievementProgress(
      {...benchmarkCourseDefinition,items:[item('Keller')]},
      {producers:[{id:'p-keller',canonicalName:'Weingut Keller'}],cuvees:[]},
      [{id:'w-keller',producerId:'p-keller',producer:'Keller',wineName:'Hubacker Riesling',vintage:2021}]
    );
    expect(result).toMatchObject({completed:1,total:1,items:[{status:'tasted',resolvedProducerId:'p-keller'}]});
  });

  it('requires the named cuvee instead of letting any wine from that producer tick it',()=>{
    const target=item('E. Guigal — La Turque');
    const registry={
      producers:[{id:'p-guigal',canonicalName:'E. Guigal'}],
      cuvees:[
        {id:'c-turque',producerId:'p-guigal',canonicalName:'La Turque'},
        {id:'c-brune',producerId:'p-guigal',canonicalName:'Brune et Blonde'}
      ]
    };
    const wrong=buildAchievementProgress(
      {...benchmarkCourseDefinition,items:[target]},registry,
      [{id:'w-brune',producerId:'p-guigal',cuveeId:'c-brune',producer:'E. Guigal',wineName:'Brune et Blonde',vintage:2020}]
    );
    expect(wrong.completed).toBe(0);
    const right=buildAchievementProgress(
      {...benchmarkCourseDefinition,items:[target]},registry,
      [{id:'w-turque',producerId:'p-guigal',cuveeId:'c-turque',producer:'E. Guigal',wineName:'La Turque',vintage:2020}]
    );
    expect(right).toMatchObject({completed:1,total:1,items:[{status:'tasted',resolvedProducerId:'p-guigal',resolvedCuveeId:'c-turque'}]});
  });
});
