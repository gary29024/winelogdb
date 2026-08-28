export function producerLinkChoices<T extends {id:string;canonicalName:string}>(items:T[],currentProducerId:string){
  return items.filter(item=>item.id!==currentProducerId)
    .sort((a,b)=>a.canonicalName.localeCompare(b.canonicalName,undefined,{sensitivity:'base'}));
}
