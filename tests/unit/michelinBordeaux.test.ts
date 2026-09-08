import { describe,expect,it } from 'vitest';
import { achievementDefinitions,curatedCollectionOrder } from '../../src/features/achievements/curatedLaunch';

const bordeauxIds=[
  'michelin-grapes-bordeaux-2026-three',
  'michelin-grapes-bordeaux-2026-two',
  'michelin-grapes-bordeaux-2026-one',
  'michelin-grapes-bordeaux-2026-selected'
] as const;

const collection=(id:string)=>{
  const result=achievementDefinitions.find(definition=>definition.id===id);
  if(!result)throw new Error(`Missing collection ${id}`);
  return result;
};

describe('MICHELIN Bordeaux 2026 achievement collections',()=>{
  it('freezes the live 83-estate selection in four edition-scoped tiers',()=>{
    expect(bordeauxIds.map(id=>collection(id).items.length)).toEqual([9,16,37,21]);
    expect(bordeauxIds.reduce((sum,id)=>sum+collection(id).items.length,0)).toBe(83);

    for(const id of bordeauxIds){
      const definition=collection(id);
      expect(definition).toMatchObject({
        category:'guide-selections',
        icon:'michelin-grapes',
        series:{id:'michelin-grapes',authority:'MICHELIN Guide',region:'Bordeaux',edition:2026}
      });
      expect(definition.references[0]?.url).toContain('guide.michelin.com');
    }
  });

  it('keeps important estate-name variants matchable without changing the display label',()=>{
    const three=collection('michelin-grapes-bordeaux-2026-three');
    const two=collection('michelin-grapes-bordeaux-2026-two');
    const one=collection('michelin-grapes-bordeaux-2026-one');

    expect(three.items.find(item=>item.label==='Petrus')?.selector).toMatchObject({
      type:'producer',producerNames:['Petrus','Pétrus']
    });
    expect(two.items.find(item=>item.label==='Château Pichon Comtesse')?.selector).toMatchObject({
      type:'producer',
      producerNames:expect.arrayContaining(['Château Pichon Longueville Comtesse de Lalande','Pichon Comtesse de Lalande'])
    });
    expect(one.items.find(item=>item.label==='Domaine de Chevalier')?.selector).toMatchObject({
      type:'producer',producerNames:expect.arrayContaining(['Domaine de Chevalier','Château de Chevalier'])
    });
  });

  it('keeps every curated card in the explicit geographic order',()=>{
    expect(new Set(curatedCollectionOrder).size).toBe(curatedCollectionOrder.length);
    expect(achievementDefinitions.map(definition=>definition.id)).toEqual(curatedCollectionOrder);
    expect(curatedCollectionOrder.slice(7,11)).toEqual([...bordeauxIds]);
    expect(curatedCollectionOrder.slice(15,19)).toEqual([
      'michelin-grapes-burgundy-2026-three',
      'michelin-grapes-burgundy-2026-two',
      'michelin-grapes-burgundy-2026-one',
      'michelin-grapes-burgundy-2026-selected'
    ]);
  });
});
