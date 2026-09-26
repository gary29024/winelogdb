import type { WineFacts } from '../wine/detailFields';
import { placeKey } from './resolve';

// Reviewed geography, independent of a bottle's classification or vintage.
// Keep evidence and the containing boundary together; these are not global
// climat aliases and never identify a producer's precise holding. La Moutonne
// alone has an explicitly approved, separately labelled producer illustration.
type ProducerLocation={
 id:string;appellation:string;producers:string[];names:string[];matchId:string;sourceUrl:string;note:string;
 climat?:string;renamedFromVintage?:number;monopole?:boolean;grandCru?:boolean;
 containingMatchIds?:string[];
 approximateOutline?:'la-moutonne';
 homonym?:{climat:string;producers:string[];sourceUrl:string;producerFieldAliases:string[];producerAliasSourceUrl:string};
};
export const producerLocations:ProducerLocation[]=[{
 id:'ferret-clos-de-jeanne',appellation:'Pouilly-Fuissé',
 producers:['Domaine Ferret','Ferret','Domaine J. A. Ferret','J. A. Ferret','Domaine JA Ferret','JA Ferret'],
 names:['Le Clos','Clos de Jeanne','Le Clos de Jeanne'],climat:'Les Perrières',
 matchId:'ba_designation_6uagv56ojvbwm2bggy7xcfhney',renamedFromVintage:2020,
 sourceUrl:'https://www.domaine-ferret.com/en/wines/2/tete-de-cru-quot-clos-de-jeanne-quot',
 note:'Ferret’s Le Clos, renamed Clos de Jeanne from the 2020 vintage, lies within Les Perrières. The highlighted area covers the whole climat, not Ferret’s 0.64 ha parcel. Pre-2020 bottles were village wines; this map does not change the bottle’s recorded classification.',
 homonym:{climat:'Le Clos',producers:['Château Fuissé','Château de Fuissé'],
  sourceUrl:'https://chateau-fuisse.fr/2-7-ha-en-1er-cru-monopole/',
  // Bernard-Massard lists Pouilly-Fuissé Le Clos under this exact producer.
  // Never use it as a title prefix: Domaine Vincent Cornin is another estate.
  producerFieldAliases:['Domaine Vincent'],
  producerAliasSourceUrl:'https://www.bernard-massard.lu/wp-content/uploads/Tarif_Bernard-Massard_2025_light.pdf#page=33'},
},{
 id:'long-depaquit-la-moutonne',appellation:'Chablis Grand Cru',
 producers:['Domaine Long-Depaquit','Long-Depaquit','Albert Bichot','Bichot','Maison Albert Bichot','Albert Bichot Domaine Long-Depaquit','Domaine Long-Depaquit Albert Bichot'],
 names:['La Moutonne','Moutonne'],monopole:true,grandCru:true,
 matchId:'france/burgundy/chablis/chablis-grand-cru',
 containingMatchIds:['inao-denom-446','inao-denom-444'],
 approximateOutline:'la-moutonne',
 sourceUrl:'https://www.albert-bichot.com/en/domaine-long-depaquit_22.html',
 note:'La Moutonne is Domaine Long-Depaquit’s monopole, reported by the producer as 2.35 ha, with about 95% in Vaudésir and 5% in Les Preuses. The dashed outline follows the producer’s illustrated map. It is schematic, draws larger than the stated holding and cannot be used to measure the parcel. This map does not change the bottle’s recorded classification.',
}];

const includes=(text:string,key:string)=>` ${text} `.includes(` ${key} `);
const starts=(text:string,key:string)=>text===key||text.startsWith(`${key} `);
function producerIs(wine:WineFacts,names:string[],fieldAliases:string[]=[]){
 const producer=placeKey(wine.producer??''),title=placeKey(wine.wineName??'');
 // A recorded producer is authoritative. Title-only evidence must start with
 // a reviewed whole producer name, not merely contain the surname somewhere.
 return producer?[...names,...fieldAliases].some(name=>placeKey(name)===producer):names.some(name=>starts(title,placeKey(name)));
}
function hasOtherProducer(wine:WineFacts,names:string[]){
 const title=placeKey(wine.wineName??'');
 return names.some(name=>includes(title,placeKey(name)));
}

/** A homonymous official climat needs its own producer evidence. Missing or
 * conflicting evidence must not redirect Ferret's Le Clos to Château Fuissé. */
export function producerAllowsClimat(wine:WineFacts,appellation:string,climat:string){
 const collision=producerLocations.find(entry=>entry.appellation===appellation&&entry.homonym?.climat===climat);
 return !collision?.homonym||(producerIs(wine,collision.homonym.producers,collision.homonym.producerFieldAliases)&&!hasOtherProducer(wine,collision.producers));
}

/** Only a complete, reviewed cuvée name with consistent place fields matches.
 * The caller must verify the returned appellation with the shared geography guards.
 * Unknown text, other vineyards, blends and conflicting references stay broad. */
export function producerMapLocation(wine:WineFacts){
 for(const entry of producerLocations){
  // A unique monopole name needs no producer field, but an explicitly different
  // producer still conflicts. The whole title parser below rejects other estates.
  if(!(entry.monopole&&!placeKey(wine.producer??''))&&!producerIs(wine,entry.producers))continue;
  if(entry.homonym&&hasOtherProducer(wine,entry.homonym.producers))continue;
  const names=entry.names.map(placeKey);
  let named=false;
  const valid=[wine.appellation,wine.wineName,wine.referenceSite,wine.referenceParcel].every((value,index)=>{
   let text=placeKey(value??'');
   if(index===1){
    const producer=entry.producers.map(placeKey).sort((a,b)=>b.length-a.length).find(name=>starts(text,name));
    if(producer)text=text.slice(producer.length).trim();
   }
   if(/[/&+]/.test(value??''))return false;
   // These are label context, not evidence of classification. In particular,
   // Ferret's historical "Tête de Cru" does not mean Premier Cru.
   text=text.replace(/\b(?:tete de cru|premier cru|1er\s*cru|aoc|aop)\b/g,' ').replace(/\b(?:19|20)\d{2}\b/g,' ');
   if(entry.monopole)text=text.replace(/\bmonopole\b/g,' ');
   const app=placeKey(entry.appellation);
   const context=entry.grandCru?[app.replace(/\bgrand cru\b/g,'').trim(),'grand cru']:[];
   for(const key of [app,...context,...names,...(entry.climat?[placeKey(entry.climat)]:[])].sort((a,b)=>b.length-a.length)){
    const pattern=new RegExp(`(?<![a-z0-9])${key}(?![a-z0-9])`,'g');
    if(names.includes(key)&&pattern.test(text))named=true;
    text=text.replace(pattern,' ');
   }
   return !text.trim();
  });
  if(valid&&named)return entry;
 }
 return null;
}
