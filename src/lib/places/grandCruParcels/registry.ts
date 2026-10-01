import bundle0 from './flagey-echezeaux.manifest.json';
import bundle1 from './vougeot.manifest.json';

/** A commune bundle's parcel file and rights snapshot, built by scripts/build_grand_cru_parcels.py. */
export type ParcelManifest=typeof bundle0;

// One entry per scripts/grand-crus/bundles/<id>.json. A bundle serves every cru in its communes,
// so several crus share one parcel download (Flagey serves Échezeaux and Grands-Échezeaux).
export const parcelBundles={'flagey-echezeaux':bundle0,'vougeot':bundle1} satisfies Record<string,ParcelManifest>;
export type ParcelBundleId=keyof typeof parcelBundles;

/** Crus whose research files feed the evidence panel; see ./evidence.ts. */
export type EvidenceSourceId='clos-de-vougeot'|'echezeaux'|'grands-echezeaux';

export type GrandCru={
 slug:string;name:string;parentFeatureId:string;
 /** Every village map where this INAO feature is available. */
 villageMaps:readonly string[];bundle:ParcelBundleId;
 /** Research evidence files read by the panel and domaine grouping; empty until the cru has research. */
 evidenceFrom:EvidenceSourceId[];
 /** True only when its research files hold holder-to-domaine links; checked against them by the registry test. */
 domaineGrouping:boolean;
};

// Mirrors scripts/grand-crus/<slug>.json (checked by tests/unit/grandCruRegistry.test.ts).
// Components look crus up here; they never name a cru or INAO feature themselves.
export const grandCrus:readonly GrandCru[]=[
 {slug:"clos-de-vougeot",name:"Clos de Vougeot",parentFeatureId:"inao-denom-546",villageMaps:["vougeot"],bundle:"vougeot",evidenceFrom:["clos-de-vougeot"],domaineGrouping:false},
 {slug:"echezeaux",name:"Échezeaux",parentFeatureId:"inao-denom-565",villageMaps:["vosne-romanee"],bundle:"flagey-echezeaux",evidenceFrom:["echezeaux"],domaineGrouping:true},
 {slug:"grands-echezeaux",name:"Grands-Échezeaux",parentFeatureId:"inao-denom-645",villageMaps:["vosne-romanee"],bundle:"flagey-echezeaux",evidenceFrom:["grands-echezeaux"],domaineGrouping:true},
];

export const cruOnVillageMap=(cru:GrandCru,villageMap:string)=>cru.villageMaps.includes(villageMap);
/** The cru with parcel rights for this INAO feature, optionally only on a given village map. */
export function grandCruFor(parentFeatureId:string,villageMap?:string){
 return grandCrus.find(cru=>cru.parentFeatureId===parentFeatureId&&(!villageMap||cruOnVillageMap(cru,villageMap)));
}

export function parcelManifestFor(parentFeatureId:string):ParcelManifest|undefined{
 const cru=grandCruFor(parentFeatureId);
 return cru&&parcelBundles[cru.bundle];
}
