import { ageingTerm,resolvePlace } from '../places/resolve';

const key=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

const countries:Record<string,string>={
  france:'France',italy:'Italy',spain:'Spain',germany:'Germany',portugal:'Portugal',austria:'Austria',australia:'Australia','new zealand':'New Zealand',
  usa:'United States','u s a':'United States','united states':'United States','united states of america':'United States',argentina:'Argentina',chile:'Chile','south africa':'South Africa'
};

const regions:Record<string,string>={
  burgundy:'Burgundy',bourgogne:'Burgundy','cote dor':"Côte d'Or",bordeaux:'Bordeaux',champagne:'Champagne',alsace:'Alsace',
  rhone:'Rhône','rhone valley':'Rhône',loire:'Loire','loire valley':'Loire',beaujolais:'Beaujolais',piedmont:'Piedmont',piemonte:'Piedmont',tuscany:'Tuscany',toscana:'Tuscany'
};

const appellations:Record<string,string>={
  bourgogne:'Bourgogne','bourgogne rouge':'Bourgogne Rouge','bourgogne blanc':'Bourgogne Blanc',
  'vosne romanee':'Vosne-Romanée','gevrey chambertin':'Gevrey-Chambertin','chambolle musigny':'Chambolle-Musigny','morey saint denis':'Morey-Saint-Denis',
  'nuits saint georges':'Nuits-Saint-Georges','puligny montrachet':'Puligny-Montrachet','chassagne montrachet':'Chassagne-Montrachet',meursault:'Meursault',
  pommard:'Pommard',volnay:'Volnay','aloxe corton':'Aloxe-Corton','savigny les beaune':'Savigny-lès-Beaune','pernand vergelesses':'Pernand-Vergelesses',
  beaune:'Beaune','corton charlemagne':'Corton-Charlemagne','cote de nuits villages':'Côte de Nuits-Villages','cote de beaune villages':'Côte de Beaune-Villages'
};

const grapes:Record<string,string>={
  'pinot noir':'Pinot Noir',chardonnay:'Chardonnay','cabernet sauvignon':'Cabernet Sauvignon','cabernet franc':'Cabernet Franc',merlot:'Merlot',syrah:'Syrah',shiraz:'Shiraz',
  grenache:'Grenache',mourvedre:'Mourvèdre','petit verdot':'Petit Verdot',malbec:'Malbec',riesling:'Riesling','sauvignon blanc':'Sauvignon Blanc',
  'chenin blanc':'Chenin Blanc','pinot gris':'Pinot Gris','pinot grigio':'Pinot Grigio',nebbiolo:'Nebbiolo',sangiovese:'Sangiovese',tempranillo:'Tempranillo'
};

function fromMap(value:string|null|undefined,map:Record<string,string>){if(!value)return value;return map[key(value)]??value.trim()}
export const canonicalCountry=(value:string|null|undefined)=>fromMap(value,countries);
export const canonicalRegion=(value:string|null|undefined)=>fromMap(value,regions);
export const canonicalAppellation=(value:string|null|undefined)=>fromMap(value,appellations);
export const canonicalGrape=(value:string)=>fromMap(value,grapes)??value.trim();

function stripRepeatedProducer(producer:string|undefined|null,wineName:string|undefined|null){
  if(!producer||!wineName)return wineName;
  const p=producer.trim(),name=wineName.trim();
  if(!p||!name)return wineName;
  const escaped=p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const stripped=name.replace(new RegExp(`^${escaped}(?:\\s*[-–—:|,]\\s*|\\s+)`,'i'),'').trim();
  return stripped||name;
}

export function canonicalizeWineFields<T extends {producer?:string|null;wineName?:string|null;country?:string|null;region?:string|null;appellation?:string|null;classification?:string|null;grapes?:string[];grapeBlend?:Array<{grape:string;percentage?:number|null}>}>(wine:T):T{
  // Spelling first, so the tree is asked about "Burgundy" rather than
  // "Bourgogne", then placement: which of region and appellation each name
  // belongs in is decided by the hierarchy, not by the slot it arrived in.
  const place=resolvePlace({
    country:canonicalCountry(wine.country),
    region:canonicalRegion(wine.region),
    appellation:canonicalAppellation(wine.appellation),
    // The cru tier is usually printed on the label rather than in the
    // appellation, so the wine name gets a say in reading it.
    wineName:wine.wineName
  });
  // An ageing tier is not a place, so it comes off the appellation - but it is
  // on the label, so it moves to the wine name rather than being dropped.
  const ageing=ageingTerm(wine.appellation);
  const named=stripRepeatedProducer(wine.producer,wine.wineName);
  const carriesAgeing=ageing&&named&&key(named).includes(key(ageing));
  return {...wine,
    wineName:(ageing&&!carriesAgeing?`${named??''} ${ageing}`.trim():named) as T['wineName'],
    country:place.country as T['country'],
    region:place.region as T['region'],
    appellation:place.appellation as T['appellation'],
    // Normalising the place drops the climat that carried the tier, so the tier
    // is recorded beside it rather than lost.
    classification:(place.classification??wine.classification??null) as T['classification'],
    grapes:wine.grapes?.map(canonicalGrape) as T['grapes'],
    grapeBlend:wine.grapeBlend?.map(x=>({...x,grape:canonicalGrape(x.grape)})) as T['grapeBlend']
  };
}
