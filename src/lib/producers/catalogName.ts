const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const GENERIC_PREFIXES=['Domaine','Maison','Château','Chateau','Estate','Winery','Weingut','Bodega','Tenuta','Azienda Agricola'] as const;

export function stripProducerCatalogPrefix(value:string,producerNames:string[]=[]){
  const input=String(value??'').trim();if(!input)return '';
  const producers=[...new Set(producerNames.map(name=>String(name??'').trim()).filter(Boolean))].sort((a,b)=>b.length-a.length);
  for(const producer of producers){
    const boundary='(?:\\s+|\\s*[-–—:]\\s*)';
    const exact=new RegExp(`^${escapeRegExp(producer)}${boundary}`,'i');
    const exactStripped=input.replace(exact,'').trim();if(exactStripped&&exactStripped!==input)return exactStripped;
    for(const generic of GENERIC_PREFIXES){
      const prefixed=new RegExp(`^${escapeRegExp(generic)}\\s+${escapeRegExp(producer)}${boundary}`,'i');
      const stripped=input.replace(prefixed,'').trim();if(stripped&&stripped!==input)return stripped;
    }
  }
  return input;
}

export function catalogNameInitial(value:string,producerNames:string[]=[]){
  const stripped=stripProducerCatalogPrefix(value,producerNames).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const significant=stripped.match(/[A-Za-z0-9]/)?.[0]??'';return /^[A-Za-z]$/.test(significant)?significant.toUpperCase():null;
}
