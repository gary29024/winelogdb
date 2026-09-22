import { ancestry,lookupPlace,resolvePlace } from '../places/resolve';
import { canonicalCountryName,canonicalRegion } from './canonicalize';
import { normalizeReferenceText } from './referenceCatalog';

/** Prove containment from the app's place tree, never from a shared country alone. */
export function regionWithin(current:string|null|undefined,reference:string|null|undefined,country?:string|null,referenceCountry?:string|null){
 const a=canonicalRegion(current),b=canonicalRegion(reference);
 if(!a||!b)return false;
 const leftCountry=normalizeReferenceText(canonicalCountryName(country)),rightCountry=normalizeReferenceText(canonicalCountryName(referenceCountry));
 if(leftCountry&&rightCountry&&leftCountry!==rightCountry)return false;
 if(normalizeReferenceText(a)===normalizeReferenceText(b))return true;
 const countryKey=leftCountry||rightCountry;
 const nodes=(value:string)=>lookupPlace(value).filter(place=>place.tier!=='country'&&(!countryKey||normalizeReferenceText(ancestry(place)[0]?.name)===countryKey));
 const left=nodes(a),right=nodes(b);
 // Ambiguous names must all agree on containment; unknown names remain differences.
 return left.length>0&&right.length>0&&left.every(place=>right.every(parent=>ancestry(place).some(step=>step.id===parent.id)));
}

/** Translate catalogue region/sub-region into the app's existing field placement. */
export function referenceAppRegion(reference:{country?:string|null;region?:string|null;subRegion?:string|null}){
 const region=reference.region?.trim()||reference.subRegion?.trim()||null,subRegion=reference.subRegion?.trim();
 if(!region)return null;
 const usableSubRegion=subRegion&&regionWithin(subRegion,region,reference.country,reference.country)?subRegion:null;
 return resolvePlace({country:reference.country,region:canonicalRegion(region),appellation:usableSubRegion}).region??region;
}
