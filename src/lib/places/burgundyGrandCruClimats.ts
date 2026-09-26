import type { WineFacts } from '../wine/detailFields';
import { burgundyAtlasPlace,burgundyAtlasWinePlace } from './burgundyAtlas';
import { PLACES } from './hierarchy';
import appellations from './burgundyAtlasAppellationLinks.json';
import registry from './burgundyVillageMapRegistry.json';
import { placeKey } from './resolve';

type Wine=WineFacts&{classification?:string|null;wineStyle?:string|null};
const key=(value:string)=>placeKey(value.replace(/œ/g,'oe'));
const marker=/\b(?:grand\s+cru|aoc|aop)\b/g;
const appellationKey=(value:string)=>key(value).replace(marker,' ').replace(/\s+/g,' ').trim();
const pattern=(name:string)=>new RegExp(`(?<![a-z0-9])${name}(?![a-z0-9])`,'g');
// Reviewed label spellings (Corton "Rognet" for INAO's "Le Rognet et Corton")
// match like the source name; without them the source's "et" reads as a blend.
const groups=registry.grandCruClimats.map(group=>({...group,key:appellationKey(group.name),
 namedWineColours:'namedWineColours' in group?group.namedWineColours as string[]:['red'],
 unmappedPatterns:('unmappedNames' in group?group.unmappedNames as string[]:[]).map(name=>pattern(key(name).replace(/^(?:les|le|la) /,''))),
 climats:group.climats.map(climat=>({...climat,
 patterns:[...new Set([climat.name,...('aliases' in climat?climat.aliases as string[]:[])].flatMap(name=>[key(name),key(name).replace(/^(?:les|le|la) /,'')]))]
  // "Corton" alone never proves "Le Corton"; generic "clos" is not Les Clos.
  .filter(name=>name!==appellationKey(group.name)&&name!=='clos').map(pattern)
}))}));
const otherPlaces=[...new Set([
 ...appellations.groups.flatMap(a=>[a.appellation,...a.aliases]),
 ...PLACES.filter(p=>p.id.startsWith('france/burgundy/')&&p.classification).flatMap(p=>[p.name,...p.aliases]),
].map(key))];

/** Local, source-backed Grand Cru climats can be mapped without an Atlas page.
 * undefined means another appellation; null means conflicting evidence. An
 * unknown/mixed climat retains only its proven parent appellation identity. */
export function burgundyGrandCruMapIdentity(wine:Wine):string|null|undefined{
 const app=appellationKey(wine.appellation??'');
 const group=groups.find(g=>app===g.key||app.startsWith(`${g.key} `));
 if(!group)return undefined;
 // Chablis shares its village name with the Grand Cru. A climat name alone
 // never promotes an ordinary Chablis to Grand Cru.
 if('requiresGrandCruEvidence' in group&&group.requiresGrandCruEvidence&&
  wine.classification!=='grand_cru'&&![wine.appellation,wine.wineName,wine.referenceSite,wine.referenceParcel]
   .some(value=>/\bgrand\s+cru\b/.test(key(value??''))))return undefined;
 // Corton-Charlemagne is its own appellation, not a Corton climat suffix.
 const exact=burgundyAtlasPlace(wine.appellation);
 if(exact&&exact.placeId!==group.matchId)return undefined;
 const raw=[wine.appellation,wine.wineName,wine.referenceSite,wine.referenceParcel];
 const fields=raw.map(value=>key(value??''));
 if(fields.some(text=>/\b(?:premier cru|1er(?: cru)?|1st cru)\b/.test(text)))return null;
 if(!burgundyAtlasWinePlace({...wine,appellation:group.name}))return null;
 const candidates=new Set<string>();let ambiguous=raw.some(value=>/[/&+]/.test(value??''));
 for(const [index,text] of fields.entries()){
  if(!text)continue;
  if(group.unmappedPatterns.some(p=>[...text.matchAll(p)].length>0))ambiguous=true;
  const found=group.climats.flatMap(climat=>climat.patterns.flatMap(p=>[...text.matchAll(p)].map(m=>({id:climat.matchId,start:m.index!,end:m.index!+m[0].length}))));
  const longest=found.filter(m=>!found.some(other=>other.start<=m.start&&other.end>=m.end&&other.end-other.start>m.end-m.start));
  const chars=[...text];
  for(const match of longest){candidates.add(match.id);chars.fill(' ',match.start,match.end)}
  const rest=chars.join('').replace(marker,' ').replace(/\s+/g,' ').trim();
  // Another place in the appellation or a reference field contradicts Corton,
  // as does a name built on Corton itself (Corton-Charlemagne, Aloxe-Corton)
  // anywhere. Any other place in the title is usually the producer (Domaine de
  // la Romanée-Conti, Château de Meursault): it withholds the climat, not the map.
  const others=otherPlaces.filter(name=>name!==group.key&&pattern(name).test(rest));
  if(others.length){
   if(index!==1||others.some(name=>pattern(group.key).test(name)))return null;
   ambiguous=true;
  }
  const remaining=rest.replace(pattern(group.key),' ').replace(/\s+/g,' ').trim();
  if(/\b(?:et|and|ou|blend|assemblage|melange|multi(?:ple)? (?:plots|parcelles|climats|vineyards))\b/.test(remaining))ambiguous=true;
  // Appellation/reference fields must identify whole places. Producer and
  // vintage words are permitted only in the wine title.
  if(index!==1&&remaining)ambiguous=true;
 }
 const colour=key(wine.colour??'')||key(wine.wineStyle??'');
 // Named Corton areas are red; Chablis Grand Cru climats are white. Preserve
 // a broad identity for a different colour, with appellation-level colour
 // validation performed by the map target resolver.
 if(colour==='rose')return null;
 if((colour&&!group.namedWineColours.includes(colour))||ambiguous||candidates.size!==1)return group.matchId;
 return [...candidates][0];
}
