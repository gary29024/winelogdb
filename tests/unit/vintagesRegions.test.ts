import { describe,expect,it } from 'vitest';
import { villageForWine } from '../../src/features/vintages/data';
import { grapeExpect,isRed,type ConditionsReading } from '../../src/features/vintages/model';
import { BORDEAUX,BURGUNDY,VINTAGE_REGIONS,regionById,regionOfVillage } from '../../src/features/vintages/regions';

describe('vintage regions',()=>{
  it('keeps village ids unique across regions, so a village names its region',()=>{
    const ids=VINTAGE_REGIONS.flatMap(region=>region.villages.map(village=>village.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(regionOfVillage('pauillac')).toBe(BORDEAUX);
    expect(regionOfVillage('meursault')).toBe(BURGUNDY);
    expect(regionOfVillage('nowhere')).toBeNull();
    expect(regionById('bordeaux')).toBe(BORDEAUX);
  });
  it('opens each region on a village and grape it has',()=>{
    for(const region of VINTAGE_REGIONS){
      expect(region.villages.some(village=>village.id===region.defaultVillage)).toBe(true);
      expect(region.grapes.some(grape=>grape.id===region.defaultGrape)).toBe(true);
      for(const village of region.villages)expect(region.areas.some(area=>area.id===village.area)).toBe(true);
    }
  });
});

describe('Bordeaux wines',()=>{
  const match=(appellation:string,wineName='')=>villageForWine({appellation,wineName},BORDEAUX.villages);
  it('places the communes',()=>{
    expect(match('Pauillac')).toBe('pauillac');
    expect(match('Saint-Émilion Grand Cru')).toBe('saint-emilion');
    expect(match('Pessac-Léognan')).toBe('pessac-leognan');
  });
  it('does not read a satellite appellation as its famous neighbour',()=>{
    expect(match('Lalande-de-Pomerol')).toBeNull();
    expect(match('Lussac-Saint-Émilion')).toBeNull();
    expect(match('Montagne Saint-Emilion')).toBeNull();
  });
});

describe('red and white readings',()=>{
  const hot:ConditionsReading={title:'',verdict:'Mixed',conditions:[
    {id:'warmth',icon:'sun',label:'Warmth',value:'Warmer',usual:'',effect:'helps'},
    {id:'heat',icon:'flame',label:'Heat stress',value:'',usual:'',effect:'hurts'},
    {id:'rain',icon:'drop',label:'Rot risk',value:'Usual',usual:'',effect:'neutral'},
    {id:'ripeness',icon:'clock',label:'Ripeness',value:'Riper',usual:'',effect:'helps'}
  ]};
  it('treats the Bordeaux grapes and the blend as reds',()=>{
    for(const grape of BORDEAUX.grapes)expect(isRed(grape.id)).toBe(true);
    expect(isRed('chardonnay')).toBe(false);
  });
  it('words a hot Bordeaux season for structured reds, not Pinot',()=>{
    const levels={warmth:2,rain:0,nights:0} as const;
    expect(grapeExpect('blend',hot,levels,-15,'shared')).toMatch(/powerful reds/);
    expect(grapeExpect('pinot-noir',hot,levels,-15,'shared')).toMatch(/full reds/);
  });
});
