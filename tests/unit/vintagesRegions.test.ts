import { describe,expect,it } from 'vitest';
import { villageForWine } from '../../src/features/vintages/data';
import { grapeExpect,isRed,readNobleRot,type ConditionsReading } from '../../src/features/vintages/model';
import { BORDEAUX,BURGUNDY,VINTAGE_REGIONS,harvestArea,pickGrape,regionById,regionOfVillage,villageGrapes } from '../../src/features/vintages/regions';

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
  it('treats the Bordeaux red grapes and the red blend as reds',()=>{
    for(const grape of BORDEAUX.grapes)expect(isRed(grape.id)).toBe(grape.colour==='red');
    expect(isRed('chardonnay')).toBe(false);
  });
  it('words a hot Bordeaux season for structured reds, not Pinot',()=>{
    const levels={warmth:2,rain:0,nights:0} as const;
    expect(grapeExpect('blend',hot,levels,-15,'shared')).toMatch(/powerful reds/);
    expect(grapeExpect('pinot-noir',hot,levels,-15,'shared')).toMatch(/full reds/);
  });
});

describe('Bordeaux whites and Sauternes',()=>{
  const village=(id:string)=>BORDEAUX.villages.find(item=>item.id===id)!;
  const grape=(id:string)=>BORDEAUX.grapes.find(item=>item.id===id)!;
  it('reads only the grapes a place grows, opening on its blend',()=>{
    const sauternes=villageGrapes(BORDEAUX,['semillon','sauvignon-blanc','blend-sweet']);
    expect(sauternes.map(item=>item.id)).toEqual(['blend-sweet','semillon','sauvignon-blanc']);
    expect(pickGrape(sauternes,'merlot',BORDEAUX.defaultGrape)).toBe('blend-sweet');
    expect(pickGrape(sauternes,'semillon',BORDEAUX.defaultGrape)).toBe('semillon');
    expect(villageGrapes(BORDEAUX,null)).toBe(BORDEAUX.grapes);
  });
  it('keeps the white grapes of a red commune on their own harvest dates',()=>{
    const index={colourAreas:{white:{'left-bank':'dry-white'}}};
    expect(harvestArea(index,village('pessac-leognan'),grape('semillon'))).toBe('dry-white');
    expect(harvestArea(index,village('pessac-leognan'),grape('blend'))).toBe('left-bank');
    expect(harvestArea(index,village('sauternes'),grape('semillon'))).toBe('sauternes');
    expect(harvestArea(null,village('pauillac'),grape('merlot'))).toBe('left-bank');
  });
  it('places Sauternes and Barsac wines',()=>{
    const match=(appellation:string)=>villageForWine({appellation,wineName:''},BORDEAUX.villages);
    expect(match('Sauternes')).toBe('sauternes');
    expect(match('Barsac')).toBe('barsac');
  });
  it('reads the noble-rot season against usual',()=>{
    const base={gdd:0,rainAprSep:0,augNights:0,frostDays:0,heatDays:0,sepRain:0};
    const normal={...base,nobleRotDays:6,greyRotDays:11};
    expect(readNobleRot({...base,nobleRotDays:13,greyRotDays:5},normal)?.expect).toMatch(/concentrated/);
    expect(readNobleRot({...base,nobleRotDays:1,greyRotDays:18},normal)?.expect).toMatch(/grey rot/);
    expect(readNobleRot({...base,nobleRotDays:0,greyRotDays:9},normal)?.noble).toBe(-1);
    expect(readNobleRot(base,normal)).toBeNull();
  });
  it('reads the white grapes as whites',()=>{
    for(const id of ['semillon','sauvignon-blanc','blend-white','blend-sweet'] as const)expect(isRed(id)).toBe(false);
  });
});
