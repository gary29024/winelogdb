/**
 * Writes public/data/vintages/burgundy/ as a SAMPLE: plausible, invented
 * numbers in the exact shape the weather pipeline will produce, so the
 * Vintages screens can be built and reviewed before the real Météo-France data
 * has been fetched. The file says `sample: true` and the page shows that.
 *
 * Replace it by running the pipeline (scripts/vintages/README.md); never edit
 * the numbers by hand.
 *
 *   bun scripts/vintages/build_sample_dataset.ts
 */
import { mkdirSync,writeFileSync } from 'node:fs';
import { BURGUNDY_VILLAGES } from '../../src/features/vintages/burgundyVillages';
import type { AreaHarvest,GrapeId,SugarCurve,VillageData,VillageNormal,VillageSeason,VintageIndex } from '../../src/features/vintages/types';

const FIRST=1995,LAST=2025;

// Harvest start relative to typical, days. Shaped on the real run of
// Burgundy vintages (2003 and 2020 very early, 2013 and 2021 late) but invented.
const SHIFT:Record<number,number>={1995:3,1996:5,1997:-2,1998:2,1999:-1,2000:0,2001:6,2002:2,2003:-24,2004:8,
  2005:-3,2006:-4,2007:-9,2008:9,2009:-6,2010:7,2011:-16,2012:4,2013:14,2014:-2,
  2015:-10,2016:5,2017:-11,2018:-10,2019:-6,2020:-20,2021:12,2022:-14,2023:-4,2024:6,2025:-12};
// Rain, Apr–Sep, as a fraction above or below normal.
const RAIN:Record<number,number>={1995:.1,1996:-.1,1997:-.15,1998:.05,1999:.2,2000:.15,2001:.25,2002:.05,2003:-.45,2004:.1,
  2005:-.3,2006:.2,2007:.3,2008:.25,2009:-.1,2010:.15,2011:-.2,2012:.3,2013:.35,2014:.1,
  2015:-.4,2016:.4,2017:-.15,2018:-.25,2019:-.3,2020:-.35,2021:.3,2022:-.45,2023:0,2024:.45,2025:-.3};
const FROST:Record<number,number>={2016:4,2017:3,2019:2,2021:5};
const HEAT_EXTRA:Record<number,number>={2003:20,2015:6,2018:5,2019:10,2020:8,2022:12,2025:9};

const AREA={
  'chablis-auxerrois':{harvest:'09-14',gdd:1250,rain:380,nights:12.6,temp:17.4},
  'cote-de-nuits':{harvest:'09-10',gdd:1380,rain:400,nights:13.4,temp:18.3},
  'hautes-cotes':{harvest:'09-17',gdd:1240,rain:420,nights:12.4,temp:17.3},
  'cote-de-beaune':{harvest:'09-08',gdd:1400,rain:405,nights:13.5,temp:18.4},
  'cote-chalonnaise':{harvest:'09-09',gdd:1430,rain:420,nights:13.7,temp:18.6},
  'maconnais':{harvest:'09-04',gdd:1520,rain:440,nights:14.1,temp:19.1}
} as const;
type AreaId=keyof typeof AREA;

/** Small, stable per-village offsets so neighbours differ a little, never randomly between runs. */
function jitter(id:string,salt:number,size:number){
  let h=2166136261^salt;
  for(const ch of id){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return ((h>>>0)%1000/1000-.5)*2*size;
}

const round=(value:number,digits=1)=>Number(value.toFixed(digits));
const mmdd=(time:number)=>new Date(time).toISOString().slice(5,10);
const iso=(time:number)=>new Date(time).toISOString().slice(0,10);
const at=(year:number,monthDay:string)=>Date.UTC(year,Number(monthDay.slice(0,2))-1,Number(monthDay.slice(3,5)));
const DAY=86_400_000;

const STEP=5,POINTS=15,START='08-01';
/** Sugar rises steeply through August and flattens into October. */
function curve(ripeOffset:number,shift=0):number[]{
  return Array.from({length:POINTS},(_,i)=>round(200+46*Math.tanh((i*STEP-ripeOffset)/38)+shift,1));
}

const harvest:Record<string,AreaHarvest>={};
for(const [id,area] of Object.entries(AREA)){
  const years:AreaHarvest['years']={};
  for(let year=FIRST;year<=LAST;year++){
    years[String(year)]={date:iso(at(year,area.harvest)+SHIFT[year]*DAY),source:id==='hautes-cotes'?'estimated':'official'};
  }
  harvest[id]={typical:area.harvest,years};
}

const grapes:GrapeId[]=['pinot-noir','chardonnay'];
const villages:Record<string,VillageData>={};

for(const village of BURGUNDY_VILLAGES){
  const area=AREA[village.area as AreaId];
  const gdd=area.gdd+jitter(village.id,1,25),rain=area.rain+jitter(village.id,2,20),nights=area.nights+jitter(village.id,3,.3);
  const typicalHarvest=at(2000,area.harvest),aug1=at(2000,START);
  const normalRipe=(grape:GrapeId)=>Math.round((typicalHarvest-aug1)/DAY)+(grape==='chardonnay'?3:1);
  const ripeningNormal={meanTemp:round(area.temp+jitter(village.id,4,.2)),coolNights:.48,heatStressDays:1,rain:110,radiation:1100};

  const normal:VillageNormal={
    gdd:Math.round(gdd),rainAprSep:Math.round(rain),augNights:round(nights),frostDays:1,heatDays:11,sepRain:55,
    grapes:Object.fromEntries(grapes.map(grape=>{
      const ripe=normalRipe(grape);
      const sugar:SugarCurve={start:START,step:STEP,values:curve(ripe)};
      return [grape,{veraison:mmdd(aug1+(ripe-38)*DAY),sugar,sugarLow:curve(ripe,-6),sugarHigh:curve(ripe,6),ripening:ripeningNormal}];
    }))
  };

  const years:Record<string,VillageSeason>={};
  for(let year=FIRST;year<=LAST;year++){
    const shift=SHIFT[year],wet=RAIN[year];
    const ripeShift=Math.round(shift*(shift>0?1.3:1));
    years[String(year)]={
      gdd:Math.round(gdd*(1-shift*.006)),
      rainAprSep:Math.round(rain*(1+wet)),
      augNights:round(nights-shift*.08),
      frostDays:FROST[year]??(shift>5?2:1),
      heatDays:Math.max(0,Math.round(11-shift*.8+(HEAT_EXTRA[year]??0))),
      sepRain:Math.round(55*(1+wet*1.2)),
      grapes:Object.fromEntries(grapes.map(grape=>{
        const ripe=normalRipe(grape)+ripeShift;
        return [grape,{
          veraison:iso(at(year,START)+(ripe-38)*DAY),
          sugar:{start:START,step:STEP,values:curve(ripe)},
          ripening:{
            meanTemp:round(ripeningNormal.meanTemp-shift*.12),
            coolNights:round(Math.min(.9,Math.max(.1,.48+shift*.012)),2),
            heatStressDays:Math.max(0,Math.round(1-shift*.15+(HEAT_EXTRA[year]??0)/4)),
            rain:Math.round(110*(1+wet*1.3)),
            radiation:Math.round(1100*(1-wet*.25))
          }
        }];
      }))
    };
  }
  villages[village.id]={normal,years};
}

const index:VintageIndex={
  region:'burgundy',
  generatedAt:new Date().toISOString(),
  sample:true,
  baseline:{from:1991,to:2020,rainFrom:1997},
  sources:[{label:'Sample data',detail:'Invented values for layout review. Not real weather.'}],
  harvest,
  villages:Object.keys(villages)
};

const dir='public/data/vintages/burgundy';
mkdirSync(dir,{recursive:true});
writeFileSync(`${dir}/index.json`,JSON.stringify(index));
let largest=0;
for(const [id,data] of Object.entries(villages)){
  const json=JSON.stringify(data);largest=Math.max(largest,json.length);
  writeFileSync(`${dir}/${id}.json`,json);
}
console.log(`Wrote sample dataset: ${index.villages.length} villages, ${LAST-FIRST+1} years, largest village file ${(largest/1024).toFixed(0)} KB`);
