import { describe,expect,it } from 'vitest';
import { buildStructureProfile,nextMilestones,unlockedAchievements,type JourneySummary } from '../../src/features/journey/model';

const summary:JourneySummary={totalWines:57,producers:28,countries:6,regions:18,appellations:31,vintages:14,favorites:8,averageRating:92.3,ratedWines:44,pricedWines:21,structuredTastings:12};

describe('Wine Journey model',()=>{
  it('finds the next milestone without losing progress after a threshold',()=>{
    const milestones=nextMilestones(summary);
    expect(milestones.find(item=>item.key==='totalWines')).toMatchObject({current:57,target:100});
    expect(milestones.find(item=>item.key==='countries')).toMatchObject({current:6,target:10});
    expect(milestones.find(item=>item.key==='structuredTastings')).toMatchObject({current:12,target:25});
  });

  it('shows only the highest unlocked threshold in each achievement family',()=>{
    const achievements=unlockedAchievements(summary);
    expect(achievements.find(item=>item.key==='totalWines')?.value).toBe(50);
    expect(achievements.find(item=>item.key==='producers')?.value).toBe(25);
    expect(achievements.find(item=>item.key==='countries')?.value).toBe(5);
  });

  it('compares the dominant structure with the highest-rated quartile',()=>{
    const profile=buildStructureProfile([
      {rating:96,structure:{acidity:'high',body:'full',finish:'long'}},
      {rating:95,structure:{acidity:'medium_plus',body:'medium_plus',finish:'long'}},
      {rating:90,structure:{acidity:'medium_plus',body:'medium_plus',finish:'medium_plus'}},
      {rating:88,structure:{acidity:'medium_plus',body:'medium',finish:'medium_plus'}}
    ]);
    expect(profile.topRatedCutoff).toBe(96);
    expect(profile.rows.find(row=>row.key==='acidity')).toMatchObject({all:'medium_plus',top:'high'});
    expect(profile.rows.find(row=>row.key==='body')).toMatchObject({top:'full'});
  });
});
