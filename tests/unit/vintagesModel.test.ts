import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { villageForWine } from '../../src/features/vintages/data';
import { closestToTypical,dayReaching,formatDay,harvestFor,readGrape,readSeason,ripeningConditions,seasonCharacter,seasonDay,seasonHeadline,seasonLevels,seasonScore,shiftLabel,shiftTone,sugarAtPicking,sugarOn } from '../../src/features/vintages/model';
import { BURGUNDY } from '../../src/features/vintages/regions';
import type { RipeningWeather,SeasonWeather,SugarCurve,VillageData,VintageIndex } from '../../src/features/vintages/types';

const normal:SeasonWeather={gdd:1400,rainAprSep:400,augNights:13.5,frostDays:1,heatDays:11,sepRain:55};
const curve:SugarCurve={start:'08-01',step:5,values:[150,160,170,180,190,200,210,220]};

describe('harvest timing',()=>{
  const harvest={typical:'09-08',years:{'2024':{date:'2024-09-14',source:'official' as const},'2022':{date:'2022-08-25',source:'estimated' as const}}};

  it('reads a late and an early start against the typical date',()=>{
    expect(harvestFor(harvest,2024)!.shiftDays).toBe(6);
    expect(harvestFor(harvest,2022)!.shiftDays).toBe(-14);
    expect(harvestFor(harvest,2022)!.source).toBe('estimated');
    expect(harvestFor(harvest,2019)).toBeNull();
  });

  it('treats picking as two weeks from the start',()=>{
    const reading=harvestFor(harvest,2024)!;
    expect(formatDay(reading.start)).toBe('14 Sep');
    expect(formatDay(reading.end)).toBe('28 Sep');
  });

  it('says early and late in words, short and long',()=>{
    expect(shiftLabel(6)).toBe('6 days later');
    expect(shiftLabel(-1)).toBe('1 day earlier');
    expect(shiftLabel(-14,'short')).toBe('14d early');
    expect(shiftLabel(0,'short')).toBe('on time');
  });

  it('tints warm-early and cool-late years from one scale',()=>{
    expect(shiftTone(-20)).toBe('early-3');
    expect(shiftTone(0)).toBe('typical');
    expect(shiftTone(6)).toBe('late-1');
    expect(shiftTone(13)).toBe('late-3');
  });
});

describe('reading a season',()=>{
  it('grades each measure against the village normal',()=>{
    expect(seasonLevels({...normal,gdd:1330,rainAprSep:590,augNights:12.8},normal)).toEqual({warmth:-1,rain:2,nights:-1});
    expect(seasonLevels(normal,normal)).toEqual({warmth:0,rain:0,nights:0});
  });

  it('names the season in three plain words',()=>{
    expect(seasonCharacter({warmth:-1,rain:2,nights:0},6)).toBe('Cool, very wet, late');
    expect(seasonCharacter({warmth:2,rain:-1,nights:1},-20)).toBe('Hot, dry, very early');
    expect(seasonCharacter({warmth:0,rain:0,nights:0},1)).toBe('Mild, even');
    expect(seasonHeadline({warmth:-1,rain:2,nights:0},6)).toBe('A cool, rainy, late vintage');
  });

  it('scores a typical year 1 and an extreme one 5',()=>{
    expect(seasonScore(0)).toBe(1);
    expect(seasonScore(9)).toBe(5);
  });

  it('marks the year whose whole season sat closest to normal',()=>{
    const harvest={typical:'09-08',years:{'2023':{date:'2023-09-04',source:'official' as const},'2024':{date:'2024-09-14',source:'official' as const}}};
    const season=(over:Partial<SeasonWeather>)=>({...normal,...over,grapes:{}});
    const readings=[readSeason(2023,season({}),{...normal,grapes:{}},harvest),readSeason(2024,season({rainAprSep:600}),{...normal,grapes:{}},harvest)];
    expect(closestToTypical(readings)).toBe(2023);
  });
});

describe('sugar',()=>{
  it('interpolates between modelled points and clamps at the ends',()=>{
    expect(sugarOn(curve,2024,seasonDay(2024,'08-01'))).toBe(150);
    expect(sugarOn(curve,2024,seasonDay(2024,'08-03'))).toBeCloseTo(154);
    expect(sugarOn(curve,2024,seasonDay(2024,'12-01'))).toBe(220);
  });

  it('finds the day the curve reaches ripeness, or none',()=>{
    expect(formatDay(dayReaching(curve,2024,200)!)).toBe('26 Aug');
    expect(formatDay(dayReaching(curve,2024,195)!)).toBe('23 Aug');
    expect(dayReaching(curve,2024,240)).toBeNull();
  });

  it('reads sugar and potential alcohol across the picking window',()=>{
    const reading=sugarAtPicking(curve,2024,seasonDay(2024,'08-16'),seasonDay(2024,'08-26'));
    expect(reading).toMatchObject({low:180,high:200});
    expect(reading.alcoholHigh).toBeCloseTo(11.9,1);
  });
});

describe('ripening conditions',()=>{
  const base:RipeningWeather={meanTemp:18.4,coolNights:.48,heatStressDays:1,rain:110,radiation:1100};

  it('reads a cool, wet finish as fresh for Chardonnay but wet',()=>{
    const reading=ripeningConditions('chardonnay',{...base,meanTemp:17.4,coolNights:.6,heatStressDays:0,rain:180},base,40,43);
    const byId=Object.fromEntries(reading.conditions.map(item=>[item.id,item.effect]));
    expect(reading.title).toBe('Freshness & acidity');
    expect(byId).toMatchObject({acidity:'helps',warmth:'helps',nights:'helps',heat:'helps',hang:'neutral',rain:'hurts'});
    expect(reading.verdict).toBe('Favourable');
  });

  it('flags sugar running ahead of tannin in a short, hot Pinot finish',()=>{
    const reading=ripeningConditions('pinot-noir',{...base,meanTemp:20,coolNights:.3,heatStressDays:6,radiation:1250},base,38,45);
    const balance=reading.conditions.find(item=>item.id==='balance')!;
    expect(balance).toMatchObject({value:'Sugar ahead',effect:'hurts'});
    expect(reading.verdict).toBe('Challenging');
  });

  it('keeps every label short enough for a two-column tile',()=>{
    for(const grape of ['pinot-noir','chardonnay'] as const)
      for(const item of ripeningConditions(grape,base,base,44,44).conditions)expect(item.label.length).toBeLessThanOrEqual(11);
  });
});

describe('the sample dataset the page ships with',()=>{
  const index=JSON.parse(readFileSync('public/data/vintages/burgundy/index.json','utf8')) as VintageIndex;

  it('says it is a sample, and covers every village in the picker',()=>{
    expect(index.sample).toBe(true);
    expect(new Set(index.villages)).toEqual(new Set(BURGUNDY.villages.map(village=>village.id)));
    for(const area of BURGUNDY.areas)expect(index.harvest[area.id]).toBeTruthy();
  });

  it('reads end to end for a village and a year',()=>{
    const data=JSON.parse(readFileSync('public/data/vintages/burgundy/meursault.json','utf8')) as VillageData;
    const season=readSeason(2024,data.years['2024'],data.normal,index.harvest['cote-de-beaune']);
    expect(season.harvest!.shiftDays).toBe(6);
    const grape=readGrape('chardonnay',2024,data.years['2024'].grapes.chardonnay!,data.normal.grapes.chardonnay,season.harvest,200);
    expect(grape.pickGap).toBeGreaterThan(grape.normalPickGap!);
    expect(grape.picking!.low).toBeLessThan(grape.picking!.high);
  });
});

describe('matching a wine to its village',()=>{
  const match=(appellation:string,wineName='')=>villageForWine({appellation,wineName},BURGUNDY.villages);

  it('reads the village from the appellation',()=>{
    expect(match('Meursault 1er Cru')).toBe('meursault');
    expect(match('Chorey-lès-Beaune')).toBe('chorey-les-beaune');
    expect(match('Beaune 1er Cru')).toBe('beaune');
    expect(match('Chassagne-Montrachet')).toBe('chassagne-montrachet');
  });

  it('places grand crus that do not carry their village name',()=>{
    expect(match('Charmes-Chambertin Grand Cru')).toBe('gevrey-chambertin');
    expect(match('Chevalier-Montrachet')).toBe('puligny-montrachet');
    expect(match('Clos de Vougeot')).toBe('vougeot');
    expect(match('Richebourg')).toBe('vosne-romanee');
    expect(match('Corton-Charlemagne')).toBe('aloxe-corton');
  });

  it('leaves a regional wine unplaced rather than guessing',()=>{
    expect(match('Bourgogne')).toBeNull();
    expect(match('Bourgogne Hautes-Côtes de Nuits')).toBe('hautes-cotes-de-nuits');
  });
});
