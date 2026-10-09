import bundle0 from './chablis.holders.json';
import bundle1 from './chambolle-morey.holders.json';
import bundle2 from './corton.holders.json';
import bundle3 from './flagey-echezeaux.holders.json';
import bundle4 from './gevrey-chambertin.holders.json';
import bundle5 from './montrachet.holders.json';
import bundle6 from './vosne-romanee.holders.json';
import bundle7 from './vougeot.holders.json';
import {grandCruFor,parcelBundles,type ParcelBundleId} from './registry';

// Right holders per INAO feature in each bundle's snapshot. Only the worker needs these, to
// refuse links to a holder outside the cru; the app reads holders from the parcel file.
const holderIndexes:Record<ParcelBundleId,Record<string,string[]>>={'chablis':bundle0,'chambolle-morey':bundle1,'corton':bundle2,'flagey-echezeaux':bundle3,'gevrey-chambertin':bundle4,'montrachet':bundle5,'vosne-romanee':bundle6,'vougeot':bundle7};

/** The cru's rights snapshot and recorded holders, or undefined when the feature has no parcel rights. */
export function parcelRightsSnapshot(parentFeatureId:string){
 const cru=grandCruFor(parentFeatureId);
 if(!cru)return undefined;
 return {rightsAsOf:parcelBundles[cru.bundle].rightsAsOf,holderIds:holderIndexes[cru.bundle][parentFeatureId]??[]};
}
