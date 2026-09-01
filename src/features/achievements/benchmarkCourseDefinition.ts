import { benchmarkProducerDefinition,benchmarkProducerHeadings } from './benchmarkProducerDefinitions';
import type { AchievementDefinition,AchievementDefinitionItem } from './types';

type NamedCuveeTarget={
  label:string;
  cuveeNames:string[];
  note:string;
  subsection?:string;
};

const slug=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

/**
 * The course sometimes names only a benchmark producer, and sometimes names a
 * particular wine from that producer. Those are different tasting goals.
 *
 * A named wine replaces the broad producer row instead of sitting beside it:
 * tasting Sassicaia should satisfy Sassicaia once, not earn a second synthetic
 * "Tenuta San Guido" tick for the same bottle. Producers with no explicitly
 * named wine stay producer-level targets.
 */
const namedCuvees:Record<string,NamedCuveeTarget[]>={
  'benchmark-edmond-vatan':[
    {label:'Clos la Néore',cuveeNames:['Clos la Néore','Clos la Neore'],note:'Sancerre · Sauvignon Blanc'}
  ],
  'benchmark-chateau-pavie':[
    {label:'Château Pavie',cuveeNames:['Château Pavie','Chateau Pavie'],note:'Saint-Émilion benchmark'}
  ],
  'benchmark-chateau-figeac':[
    {label:'Château Figeac',cuveeNames:['Château Figeac','Chateau Figeac','Château-Figeac','Chateau-Figeac'],note:'Saint-Émilion benchmark'}
  ],
  'benchmark-chateau-angelus':[
    {label:'Château Angélus',cuveeNames:['Château Angélus','Chateau Angélus','Chateau Angelus'],note:'Saint-Émilion benchmark'}
  ],
  'benchmark-chateau-ausone':[
    {label:'Château Ausone',cuveeNames:['Château Ausone','Chateau Ausone'],note:'Saint-Émilion benchmark'}
  ],
  'benchmark-chateau-cheval-blanc':[
    {label:'Château Cheval Blanc',cuveeNames:['Château Cheval Blanc','Chateau Cheval Blanc'],note:'Saint-Émilion benchmark'}
  ],
  'benchmark-e-guigal':[
    {label:'La Doriane',cuveeNames:['La Doriane','Condrieu La Doriane'],note:'Condrieu',subsection:'Condrieu'},
    {label:'La Turque',cuveeNames:['La Turque','Côte-Rôtie La Turque','Cote-Rotie La Turque'],note:'Côte-Rôtie',subsection:'Côte-Rôtie'},
    {label:'La Mouline',cuveeNames:['La Mouline','Côte-Rôtie La Mouline','Cote-Rotie La Mouline'],note:'Côte-Rôtie',subsection:'Côte-Rôtie'},
    {label:'La Landonne',cuveeNames:['La Landonne','Côte-Rôtie La Landonne','Cote-Rotie La Landonne'],note:'Côte-Rôtie',subsection:'Côte-Rôtie'},
    {label:"Vignes de l'Hospice",cuveeNames:["Vignes de l'Hospice",'Vignes de l’Hospice'],note:'Saint-Joseph',subsection:'Saint-Joseph'},
    {label:'Lieu-Dit',cuveeNames:['Lieu-Dit','Lieu Dit','Saint-Joseph Lieu-Dit','Saint-Joseph Lieu Dit'],note:'Saint-Joseph',subsection:'Saint-Joseph'}
  ],
  'benchmark-paul-jaboulet-aine':[
    {label:'La Chapelle Hermitage',cuveeNames:['La Chapelle','La Chapelle Hermitage','Hermitage La Chapelle'],note:'Hermitage',subsection:'Hermitage'}
  ],
  'benchmark-delas-freres':[
    {label:'Les Bessards',cuveeNames:['Les Bessards','Hermitage Les Bessards'],note:'Hermitage',subsection:'Hermitage'}
  ],
  'benchmark-bodegas-el-nido':[
    {label:'El Nido',cuveeNames:['El Nido'],note:'Jumilla'}
  ],
  'benchmark-vega-sicilia':[
    {label:'Único',cuveeNames:['Único','Unico','Vega Sicilia Único','Vega Sicilia Unico'],note:'Ribera del Duero'}
  ],
  'benchmark-dominio-de-pingus':[
    {label:'Pingus',cuveeNames:['Pingus'],note:'Ribera del Duero'}
  ],
  'benchmark-la-rioja-alta':[
    {label:'Gran Reserva 904',cuveeNames:['Gran Reserva 904','904','Rioja Gran Reserva 904'],note:'Rioja'}
  ],
  'benchmark-cvne':[
    {label:'Imperial',cuveeNames:['Imperial','Imperial Gran Reserva','Imperial Reserva'],note:'Rioja'}
  ],
  'benchmark-lopez-de-heredia':[
    {label:'Viña Tondonia',cuveeNames:['Viña Tondonia','Vina Tondonia','Viña Tondonia Reserva','Vina Tondonia Reserva'],note:'Rioja'}
  ],
  'benchmark-edoardo-valentini':[
    {label:"Trebbiano d'Abruzzo",cuveeNames:["Trebbiano d'Abruzzo",'Trebbiano d’Abruzzo'],note:'Abruzzo'},
    {label:"Montepulciano d'Abruzzo",cuveeNames:["Montepulciano d'Abruzzo",'Montepulciano d’Abruzzo'],note:'Abruzzo'},
    {label:"Cerasuolo d'Abruzzo",cuveeNames:["Cerasuolo d'Abruzzo",'Cerasuolo d’Abruzzo'],note:'Abruzzo'}
  ],
  'benchmark-tenuta-san-guido':[
    {label:'Sassicaia',cuveeNames:['Sassicaia','Bolgheri Sassicaia'],note:'Tuscany · Bordeaux-style benchmark'}
  ],
  'benchmark-masseto':[
    {label:'Masseto',cuveeNames:['Masseto'],note:'Tuscany · Merlot benchmark'}
  ],
  'benchmark-marchesi-antinori':[
    {label:'Solaia',cuveeNames:['Solaia'],note:'Tuscany · Bordeaux-style benchmark'}
  ],
  'benchmark-gaja':[
    {label:"Ca'Marcanda",cuveeNames:["Ca'Marcanda",'Ca’Marcanda','Camarcanda'],note:'Tuscany · Bordeaux-style benchmark'}
  ],
  'benchmark-niepoort':[
    {label:'Charme',cuveeNames:['Charme'],note:'Douro'},
    {label:'Coche',cuveeNames:['Coche'],note:'Douro'}
  ],
  'benchmark-penfolds':[
    {label:'Yattarna',cuveeNames:['Yattarna'],note:'Australian Chardonnay'}
  ],
  'benchmark-henschke':[
    {label:'Hill of Grace',cuveeNames:['Hill of Grace','Hill of Grace Vineyard'],note:'Eden Valley'}
  ],
  'benchmark-stags-leap-wine-cellars':[
    {label:'Cask 23',cuveeNames:['Cask 23','CASK 23'],note:'Napa Valley'}
  ],
  'benchmark-the-sadie-family-wines':[
    {label:'Columella',cuveeNames:['Columella'],note:'South Africa'}
  ]
};

function specificItems(item:AchievementDefinitionItem):AchievementDefinitionItem[]{
  const targets=namedCuvees[item.id];
  if(!targets||item.selector.type!=='producer')return [item];
  const producerNames=item.selector.producerNames;
  return targets.map(target=>({
    id:`${item.id}-cuvee-${slug(target.label)}`,
    label:item.label===target.label?target.label:`${item.label} — ${target.label}`,
    note:target.note,
    selector:{type:'cuvee',producerNames,cuveeNames:target.cuveeNames}
  }));
}

const chrisRingland:AchievementDefinitionItem={
  id:'benchmark-chris-ringland-cuvee-dry-grown-barossa-ranges-shiraz',
  label:'Chris Ringland — Dry Grown Barossa Ranges Shiraz',
  note:'Barossa Ranges · Shiraz',
  selector:{type:'cuvee',producerNames:['Chris Ringland','Ringland Vintners'],cuveeNames:['Dry Grown Barossa Ranges Shiraz','Dry Grown Barossa Ranges']}
};

const transformed=benchmarkProducerDefinition.items.flatMap(specificItems);
const courseItems=transformed.flatMap(item=>item.id==='benchmark-yering-station'?[item,chrisRingland]:[item]);

export const benchmarkCourseDefinition:AchievementDefinition={
  ...benchmarkProducerDefinition,
  title:'World Benchmark Producers & Cuvées',
  subtitle:'One course-derived tasting checklist. Producer-only examples count at producer level; specifically named wines must match that cuvée.',
  items:courseItems
};

export const benchmarkCourseHeadings:Record<string,{section:string;subsection:string|null}>=Object.fromEntries([
  ...benchmarkProducerDefinition.items.flatMap(item=>{
    const base=benchmarkProducerHeadings[item.id]??{section:null,subsection:null};
    const targets=namedCuvees[item.id];
    if(!targets)return [[item.id,base] as const];
    return targets.map(target=>[
      `${item.id}-cuvee-${slug(target.label)}`,
      {section:base.section,subsection:target.subsection??base.subsection}
    ] as const);
  }),
  [chrisRingland.id,{section:'Australia',subsection:'Barossa Ranges'}]
]);
