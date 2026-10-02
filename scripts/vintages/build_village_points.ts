/**
 * Writes the weather sampling point for every Burgundy village the Vintages
 * page covers: the area-weighted centre of the village appellation's mapped
 * vineyard, read from the INAO boundaries already shipped in public/maps.
 *
 * Using the vineyard's own centre rather than the village church matters on
 * the Côte, where the houses sit on the plain and the vines on the slope above.
 *
 *   npx vite-node scripts/vintages/build_village_points.ts
 */
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';

type Ring=[number,number][];
type Geometry={type:'Polygon';coordinates:Ring[]}|{type:'MultiPolygon';coordinates:Ring[][]};
type Feature={properties:{tier?:string;name?:string};geometry:Geometry};

const MAP_VERSION='2026-09-21';

// id, display name, map file, area. Order is the order the picker shows.
const VILLAGES:[string,string,string,string][]=[
  ['chablis','Chablis','chablis','chablis-auxerrois'],
  ['irancy','Irancy','irancy','chablis-auxerrois'],
  ['saint-bris','Saint-Bris','saint-bris','chablis-auxerrois'],
  ['marsannay','Marsannay','marsannay','cote-de-nuits'],
  ['fixin','Fixin','fixin','cote-de-nuits'],
  ['gevrey-chambertin','Gevrey-Chambertin','gevrey-chambertin','cote-de-nuits'],
  ['morey-saint-denis','Morey-Saint-Denis','morey-saint-denis','cote-de-nuits'],
  ['chambolle-musigny','Chambolle-Musigny','chambolle-musigny','cote-de-nuits'],
  ['vougeot','Vougeot','vougeot','cote-de-nuits'],
  ['vosne-romanee','Vosne-Romanée','vosne-romanee','cote-de-nuits'],
  ['nuits-saint-georges','Nuits-Saint-Georges','nuits-saint-georges','cote-de-nuits'],
  ['hautes-cotes-de-nuits','Hautes-Côtes de Nuits','bourgogne-hautes-cotes-de-nuits','hautes-cotes'],
  ['hautes-cotes-de-beaune','Hautes-Côtes de Beaune','bourgogne-hautes-cotes-de-beaune','hautes-cotes'],
  ['ladoix','Ladoix','ladoix','cote-de-beaune'],
  ['aloxe-corton','Aloxe-Corton','aloxe-corton','cote-de-beaune'],
  ['pernand-vergelesses','Pernand-Vergelesses','pernand-vergelesses','cote-de-beaune'],
  ['savigny-les-beaune','Savigny-lès-Beaune','savigny-les-beaune','cote-de-beaune'],
  ['chorey-les-beaune','Chorey-lès-Beaune','chorey-les-beaune','cote-de-beaune'],
  ['beaune','Beaune','beaune','cote-de-beaune'],
  ['pommard','Pommard','pommard','cote-de-beaune'],
  ['volnay','Volnay','volnay','cote-de-beaune'],
  ['monthelie','Monthélie','monthelie','cote-de-beaune'],
  ['auxey-duresses','Auxey-Duresses','auxey-duresses','cote-de-beaune'],
  ['saint-romain','Saint-Romain','saint-romain','cote-de-beaune'],
  ['meursault','Meursault','meursault','cote-de-beaune'],
  ['blagny','Blagny','blagny','cote-de-beaune'],
  ['puligny-montrachet','Puligny-Montrachet','puligny-montrachet','cote-de-beaune'],
  ['chassagne-montrachet','Chassagne-Montrachet','chassagne-montrachet','cote-de-beaune'],
  ['saint-aubin','Saint-Aubin','saint-aubin','cote-de-beaune'],
  ['santenay','Santenay','santenay','cote-de-beaune'],
  ['maranges','Maranges','maranges','cote-de-beaune'],
  ['bouzeron','Bouzeron','bouzeron','cote-chalonnaise'],
  ['rully','Rully','rully','cote-chalonnaise'],
  ['mercurey','Mercurey','mercurey','cote-chalonnaise'],
  ['givry','Givry','givry','cote-chalonnaise'],
  ['montagny','Montagny','montagny','cote-chalonnaise'],
  ['vire-clesse','Viré-Clessé','vire-clesse','maconnais'],
  ['pouilly-fuisse','Pouilly-Fuissé','pouilly-fuisse','maconnais'],
  ['saint-veran','Saint-Véran','saint-veran','maconnais']
];

/** Signed area and area-weighted centroid of one ring (planar; fine at village scale). */
function ringCentroid(ring:Ring){
  let area=0,cx=0,cy=0;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [x0,y0]=ring[j],[x1,y1]=ring[i];
    const cross=x0*y1-x1*y0;
    area+=cross;cx+=(x0+x1)*cross;cy+=(y0+y1)*cross;
  }
  area/=2;
  return area===0?{area:0,x:ring[0][0],y:ring[0][1]}:{area,x:cx/(6*area),y:cy/(6*area)};
}

function centroid(geometry:Geometry){
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  let total=0,x=0,y=0;
  for(const polygon of polygons)polygon.forEach((ring,index)=>{
    // Outer ring adds, holes subtract - whatever their winding in the source.
    const c=ringCentroid(ring),weight=Math.abs(c.area)*(index===0?1:-1);
    total+=weight;x+=c.x*weight;y+=c.y*weight;
  });
  return {lon:x/total,lat:y/total};
}

const points:{id:string;name:string;area:string;lat:number;lon:number;map:string}[]=[];
const rows=VILLAGES.map(([id,name,file,area])=>{
  const geo=JSON.parse(readFileSync(`public/maps/${file}.${MAP_VERSION}.geojson`,'utf8')) as {features:Feature[]};
  const feature=geo.features.find(item=>item.properties.tier==='village')??geo.features.find(item=>item.properties.tier==='regional');
  if(!feature)throw new Error(`${file}: no village or regional boundary`);
  const {lat,lon}=centroid(feature.geometry);
  points.push({id,name,area,lat:Number(lat.toFixed(4)),lon:Number(lon.toFixed(4)),map:`public/maps/${file}.${MAP_VERSION}.geojson`});
  return `  {id:'${id}',name:'${name.replace(/'/g,"\\'")}',area:'${area}',lat:${lat.toFixed(4)},lon:${lon.toFixed(4)}}`;
});

writeFileSync('src/features/vintages/burgundyVillages.ts',`// Generated by scripts/vintages/build_village_points.ts from the INAO village
// boundaries in public/maps (${MAP_VERSION}). Do not edit by hand.
import type { VintageVillage } from './types';

export const BURGUNDY_VILLAGES:readonly VintageVillage[]=[
${rows.join(',\n')}
];
`);
// The weather pipeline (Python) reads the same list, with each village's map file.
mkdirSync('scripts/vintages/data',{recursive:true});
writeFileSync('scripts/vintages/data/villages.json',JSON.stringify(points,null,1)+'\n');
console.log(`Wrote ${rows.length} villages`);
