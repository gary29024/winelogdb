export const SHARED_PRODUCER_PREFIX='shared::';

export const sharedProducerId=(sourceOwner:string,producerId:string)=>
  `${SHARED_PRODUCER_PREFIX}${encodeURIComponent(sourceOwner)}::${encodeURIComponent(producerId)}`;

export function parseSharedProducerId(value:string){
  if(!value.startsWith(SHARED_PRODUCER_PREFIX))return null;
  const parts=value.slice(SHARED_PRODUCER_PREFIX.length).split('::');
  if(parts.length!==2)return null;
  try{return {sourceOwner:decodeURIComponent(parts[0]),producerId:decodeURIComponent(parts[1])}}
  catch{return null}
}
