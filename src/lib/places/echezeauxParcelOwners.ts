import { placeKey } from './resolve';

const forms=new Set(['GFA','GFV','SA','SAS','SARL','SCEA','SCEV','SCI','EARL','GAEC','SCA','BND','BJ','HOR']);
const particles=new Set(['de','du','des','la','le','les','et','en','aux']);
/** DGFiP names are upper case. Show them as names while keeping legal-form acronyms. */
export function ownerName(name:string){
 return name.toLowerCase().split(/(\s+|-)/).map((word,index)=>{
  if(!word.trim()||word==='-')return word;
  if(forms.has(word.toUpperCase()))return word.toUpperCase();
  if(index>0&&particles.has(word))return word;
  return word.replace(/^(d'|l')?(.)/,(_,prefix:string|undefined,letter:string)=>(prefix??'')+letter.toUpperCase());
 }).join('');
}

// Words that describe a business rather than identify a family or estate.
const generic=new Set(['domaine','domaines','maison','chateau','clos','gfa','gfv','sa','sas','sarl','scea','scev','sci','earl','gaec','sca',
 'et','fils','freres','pere','heritiers','famille','du','de','des','la','le','les','societe','groupement','foncier','viticole','vinicole',
 'vignobles','grands','crus','cru','and','sons','cie']);
const nameTokens=(value:string)=>placeKey(value).split(' ').filter(word=>word.length>=3&&!generic.has(word));
/** A name-only suggestion, never evidence: every distinctive word of the
 * producer's name must appear as a whole word in the owner's name. */
export function possibleOwnerMatch(producer:string,owner:string){
 const wanted=nameTokens(producer),have=new Set(nameTokens(owner));
 return (wanted.length>=2||wanted[0]?.length>=6)&&wanted.every(word=>have.has(word));
}
