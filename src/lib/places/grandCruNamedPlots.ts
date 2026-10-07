import type {WineFacts} from '../wine/detailFields';
import {burgundyAtlasWinePlace} from './burgundyAtlas';
import {placeKey} from './resolve';
import {PLACES} from './hierarchy';
import appellations from './burgundyAtlasAppellationLinks.json';
import {namedPlotCrus} from './grandCruParcels/namedPlots';

type Wine=WineFacts&{classification?:string|null;wineStyle?:string|null};
const marker=/\b(?:grand cru|aoc|aop)\b/g;
const pattern=(name:string)=>new RegExp(`(?<![a-z0-9])${placeKey(name)}(?![a-z0-9])`,'g');
const otherPlaces=[...new Set([
 ...appellations.groups.flatMap(a=>[a.appellation,...a.aliases]),
 ...PLACES.filter(p=>p.id.startsWith('france/burgundy/')&&p.classification).flatMap(p=>[p.name,...p.aliases]),
].map(placeKey))];

/** A named area is a display selection inside the proven Grand Cru, never a
 * replacement wine identity. Unknown or blended names keep the parent map. */
export function grandCruNamedPlotIdentity(wine:Wine):{matchId:string;plotId?:string}|null|undefined{
 const app=placeKey(wine.appellation??'').replace(marker,' ').replace(/\s+/g,' ').trim();
 const cru=namedPlotCrus.find(cru=>app===placeKey(cru.name)||app.startsWith(placeKey(cru.name)+' '));
 if(!cru)return undefined;
 const {index}=cru,parentName=placeKey(cru.name);
 // A plot named exactly like its cru (Clos des Lambrays) is only one part of it: the cru's own
 // name keeps the whole-cru outline, so that plot is selected by its aliases or on the map only.
 const plots=index.plots.map(plot=>({...plot,patterns:[plot.name,...plot.aliases].filter(name=>placeKey(name)!==parentName).map(pattern)}));
 if(!burgundyAtlasWinePlace({...wine,appellation:cru.name}))return null;
 const fields=[wine.appellation,wine.wineName,wine.referenceSite,wine.referenceParcel];
 const colour=placeKey(wine.colour??'')||placeKey(wine.wineStyle??'');
 if(['white','rose'].includes(colour)||fields.some(value=>/\b(?:premier cru|1er(?: cru)?|1st cru)\b/.test(placeKey(value??''))))return null;
 const broad={matchId:index.parentMatchId};
 if(fields.some(value=>/[/&+]/.test(value??'')))return broad;
 const ids=new Set<string>();let ambiguous=false;
 for(const [field,value] of fields.entries()){
  const text=placeKey(value??'');if(!text)continue;
  const matches=plots.flatMap(plot=>plot.patterns.flatMap(p=>[...text.matchAll(p)].map(m=>({id:plot.id,start:m.index,end:m.index+m[0].length}))));
  const longest=matches.filter(m=>!matches.some(other=>other.start<=m.start&&other.end>=m.end&&other.end-other.start>m.end-m.start));
  const chars=[...text];
  for(const match of longest){ids.add(match.id);chars.fill(' ',match.start,match.end)}
  const rest=chars.join('').replace(marker,' ').replace(/\s+/g,' ').trim();
  if(otherPlaces.some(name=>name!==parentName&&pattern(name).test(rest))){
   if(field!==1)return null;
   ambiguous=true;
  }
  const remaining=rest.replace(pattern(parentName),' ').replace(/\s+/g,' ').trim();
  // Appellation and accepted reference fields must be fully recognised. The
  // free-form title may contain a producer/vintage, but never a blend signal,
  // another known plot, or the unresolved Poulaillères name.
  if(field!==1&&remaining)ambiguous=true;
  if(/\b(?:et|and|ou|blend|assemblage|melange|multi(?:ple)?|poulailleres|poula|beaux monts hauts|grands echezeaux|clos de vougeot|vosne romanee)\b/.test(remaining))ambiguous=true;
 }
 return !ambiguous&&ids.size===1?{...broad,plotId:[...ids][0]}:broad;
}
