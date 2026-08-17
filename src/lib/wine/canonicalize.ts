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

export function canonicalizeWineFields<T extends {country?:string|null;region?:string|null;appellation?:string|null;grapes?:string[];grapeBlend?:Array<{grape:string;percentage?:number|null}>}>(wine:T):T{
  return {...wine,
    country:canonicalCountry(wine.country) as T['country'],
    region:canonicalRegion(wine.region) as T['region'],
    appellation:canonicalAppellation(wine.appellation) as T['appellation'],
    grapes:wine.grapes?.map(canonicalGrape) as T['grapes'],
    grapeBlend:wine.grapeBlend?.map(x=>({...x,grape:canonicalGrape(x.grape)})) as T['grapeBlend']
  };
}
