import { describe,expect,it } from 'vitest';
import { passportCollectionKicker,passportCollectionSummary,selectPassportCollections } from '../../src/features/achievements/passportPreview';
import type { AchievementProgress } from '../../src/features/achievements/types';

function collection(id:string,{completed=0,total=10,possible=0,series=false}:{completed?:number;total?:number;possible?:number;series?:boolean}={}):AchievementProgress{
  const complete=completed===total&&total>0;
  return {
    definition:{
      id,title:id,subtitle:id,category:series?'guide-selections':'iconic-estates',icon:series?'michelin-grapes':'first-growth',items:[],references:[],
      ...(series?{series:{id:'michelin-grapes',authority:'MICHELIN Guide',region:'Burgundy',edition:2026,tier:'three'}}:{})
    },
    completed,possible,pending:Math.max(0,total-completed-possible),total,percent:total?Math.round(completed/total*100):0,complete,items:[]
  };
}

describe('Passport collection preview',()=>{
  it('keeps one earned stamp visible and then shows the closest unfinished collections',()=>{
    const result=selectPassportCollections([
      collection('completed-large',{completed:20,total:20}),
      collection('completed-small',{completed:5,total:5}),
      collection('active-40',{completed:4,total:10}),
      collection('active-80',{completed:8,total:10}),
      collection('active-60',{completed:6,total:10})
    ]);
    expect(result.map(item=>item.definition.id)).toEqual(['completed-small','active-80','active-60']);
  });

  it('falls back to curated launch collections when there is no progress yet',()=>{
    const result=selectPassportCollections([
      collection('judgment-of-paris-1976'),
      collection('other'),
      collection('michelin-grapes-burgundy-2026-three',{series:true}),
      collection('bordeaux-first-growths')
    ]);
    expect(result.map(item=>item.definition.id)).toEqual([
      'bordeaux-first-growths','michelin-grapes-burgundy-2026-three','judgment-of-paris-1976'
    ]);
  });

  it('uses possible identity matches after active progress and never duplicates a card',()=>{
    const result=selectPassportCollections([
      collection('bordeaux-first-growths',{possible:2}),
      collection('active',{completed:1,total:5}),
      collection('possible-most',{possible:3}),
      collection('judgment-of-paris-1976')
    ]);
    expect(result.map(item=>item.definition.id)).toEqual(['active','possible-most','bordeaux-first-growths']);
    expect(new Set(result.map(item=>item.definition.id)).size).toBe(result.length);
  });

  it('summarizes complete, active and possible progress for the Passport heading',()=>{
    expect(passportCollectionSummary([
      collection('done',{completed:5,total:5}),
      collection('active',{completed:2,total:10,possible:1}),
      collection('possible',{possible:2}),
      collection('empty')
    ])).toEqual({complete:1,active:1,possible:3,total:4});
  });

  it('uses clear preview kickers for earned, active, linking and MICHELIN states',()=>{
    expect(passportCollectionKicker(collection('done',{completed:5,total:5}))).toBe('STAMP EARNED');
    expect(passportCollectionKicker(collection('active',{completed:1,total:5}))).toBe('IN PROGRESS');
    expect(passportCollectionKicker(collection('possible',{possible:1}))).toBe('NEEDS LINKING');
    expect(passportCollectionKicker(collection('michelin',{series:true}))).toBe('MICHELIN GUIDE · 2026');
  });
});
