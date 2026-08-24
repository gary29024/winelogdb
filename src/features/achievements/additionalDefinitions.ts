import type { AchievementDefinition,AchievementDefinitionItem } from './types';

const slug=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
type NamedEntry=string|readonly [string,...string[]];
const producerItems=(prefix:string,entries:readonly NamedEntry[]):AchievementDefinitionItem[]=>entries.map(entry=>{
  const values=typeof entry==='string'?[entry]:[entry[0],...entry.slice(1)],label=values[0];
  return {id:`${prefix}-${slug(label)}`,label,selector:{type:'producer',producerNames:values}};
});
const chablisSite=(name:string,...aliases:string[]):AchievementDefinitionItem=>({
  id:`chablis-grand-cru-${slug(name)}`,label:name,
  selector:{type:'site',cuveeNames:[name,...aliases,`Chablis Grand Cru ${name}`,`Chablis ${name} Grand Cru`,`${name} Chablis Grand Cru`],appellationNames:['Chablis Grand Cru',`Chablis Grand Cru ${name}`,`Chablis ${name} Grand Cru`,`${name} Grand Cru`]}
});

const australianFamilies:readonly NamedEntry[]=[
  ["Best’s Great Western","Best's Great Western","Best's Wines","Best’s Wines"],
  'Brown Brothers','Campbells',
  'Clonakilla',
  ["d’Arenberg","d'Arenberg"],
  'Henschke','Howard Park',
  ['Jim Barry Wines','Jim Barry'],
  'Tahbilk',
  ['Taylors Wines','Taylors','Wakefield Wines','Wakefield Taylors'],
  ["Tyrrell’s Wines","Tyrrell's Wines","Tyrrell’s","Tyrrell's"],
  'Yalumba'
];
const nzFamilyOfTwelve:readonly NamedEntry[]=[
  'Kumeu River','Villa Maria',
  ['Millton Vineyards','The Millton Vineyard','Millton Vineyard'],
  'Craggy Range','Ata Rangi','Palliser Estate','Neudorf Vineyards','Nautilus Estate','Fromm Winery',
  ["Lawson’s Dry Hills","Lawson's Dry Hills","Lawson’s Dry Hills Wines","Lawson's Dry Hills Wines"],
  'Pegasus Bay','Felton Road'
];
const grandiMarchi:readonly NamedEntry[]=[
  ['Marchesi Antinori','Antinori'],
  'Argiolas',
  ["Ca’ del Bosco","Ca' del Bosco","Ca del Bosco"],
  ['Carpenè Malvolti','Carpene Malvolti'],
  ["Col d’Orcia","Col d'Orcia"],
  'Donnafugata','Jermann','Lungarotti','Masi','Mastroberardino','Michele Chiarlo','Pio Cesare','Rivera',
  ["Tasca d’Almerita","Tasca d'Almerita","Tasca dAlmerita"],
  'Tenuta San Guido','Tenuta San Leonardo','Tenute Folonari','Umani Ronchi'
];
const amaroneFamilies:readonly NamedEntry[]=[
  'Allegrini','Begali','Bertani','Brigaldara','Guerrieri Rizzardi','Masi','Musella','Speri','Tedeschi',
  ["Tenuta Sant’Antonio","Tenuta Sant'Antonio","Tenuta Sant Antonio"],
  'Tommasi',
  ["Torre D’Orti","Torre D'Orti","Torre d’Orti","Torre d'Orti"],
  'Zenato'
];

export const additionalAchievementDefinitions:AchievementDefinition[]=[
  {
    id:'chablis-seven-grand-cru-climats',title:'The 7 Chablis Grand Cru Climats',subtitle:'Taste all seven named Climats of the Chablis Grand Cru appellation.',category:'regional-exploration',icon:'burgundy-grand-cru',
    references:[{title:'Vins de Chablis · Chablis Grand Cru',url:'https://www.chablis.fr/explorez/les-appellations-de-chablis/chablis-grand-cru/chablis-grand-cru%2C1248%2C6999.html'}],
    items:[chablisSite('Blanchot'),chablisSite('Bougros'),chablisSite('Les Clos'),chablisSite('Grenouilles'),chablisSite('Les Preuses','Preuses'),chablisSite('Valmur'),chablisSite('Vaudésir','Vaudesir')]
  },
  {
    id:'australia-first-families',title:"Australia’s First Families of Wine",subtitle:'Taste a wine from each of the 12 current multi-generational family wineries in AFFW.',category:'iconic-estates',icon:'first-growth',
    references:[{title:"Australia's First Families of Wine · Our Families",url:'https://www.australiasfirstfamiliesofwine.com.au/our-families/'}],items:producerItems('affw',australianFamilies)
  },
  {
    id:'new-zealand-family-of-twelve',title:'New Zealand Family of Twelve',subtitle:'Taste all 12 wineries in the collaborative Family of Twelve.',category:'iconic-estates',icon:'beaujolais-crus',
    references:[{title:'Te Hono · The Family of Twelve',url:'https://www.tehono.co.nz/stories-family-of-twelve'}],items:producerItems('nz12',nzFamilyOfTwelve)
  },
  {
    id:'italy-istituto-grandi-marchi',title:'Istituto Grandi Marchi',subtitle:'Taste all 18 Italian wineries represented by the Istituto Grandi Marchi.',category:'iconic-estates',icon:'saint-emilion',
    references:[{title:'Istituto Grandi Marchi · The Wineries',url:'https://www.istitutograndimarchi.it/en/'}],items:producerItems('igm',grandiMarchi)
  },
  {
    id:'amarone-famiglie-storiche',title:'Famiglie Storiche · Amarone',subtitle:'Taste all 13 historic Valpolicella families in the Famiglie Storiche association.',category:'iconic-estates',icon:'rhone-crus',
    references:[{title:'Famiglie Storiche · Families',url:'https://famigliestoriche.it/en/families/'}],items:producerItems('amarone-family',amaroneFamilies)
  }
];
