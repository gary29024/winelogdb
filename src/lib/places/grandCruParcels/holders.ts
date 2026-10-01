import bundle0 from './flagey-echezeaux.holders.json';
import bundle1 from './vougeot.holders.json';
import {grandCruFor,parcelBundles,type ParcelBundleId} from './registry';

// Right holders per INAO feature in each bundle's snapshot. Only the worker needs these, to
// refuse links to a holder outside the cru; the app reads holders from the parcel file.
const holderIndexes:Record<ParcelBundleId,Record<string,string[]>>={'flagey-echezeaux':bundle0,'vougeot':bundle1};

/** The cru's rights snapshot and recorded holders, or undefined when the feature has no parcel rights. */
export function parcelRightsSnapshot(parentFeatureId:string){
 const cru=grandCruFor(parentFeatureId);
 if(!cru)return undefined;
 return {rightsAsOf:parcelBundles[cru.bundle].rightsAsOf,holderIds:holderIndexes[cru.bundle][parentFeatureId]??[]};
}
