import bundle0 from './chambolle-morey.manifest.json';
import bundle1 from './flagey-echezeaux.manifest.json';
import bundle2 from './vosne-romanee.manifest.json';
import bundle3 from './vougeot.manifest.json';

/** A commune bundle's parcel file and rights snapshot, built by scripts/build_grand_cru_parcels.py. */
export type ParcelManifest=typeof bundle0;

// One entry per scripts/grand-crus/bundles/<id>.json. A bundle serves every cru in its communes,
// so several crus share one parcel download (Flagey serves Échezeaux and Grands-Échezeaux).
export const parcelBundles={'chambolle-morey':bundle0,'flagey-echezeaux':bundle1,'vosne-romanee':bundle2,'vougeot':bundle3} satisfies Record<string,ParcelManifest>;
export type ParcelBundleId=keyof typeof parcelBundles;

/** Crus whose research files feed the evidence panel; see ./evidence.ts. */
export type EvidenceSourceId='bonnes-mares'|'clos-de-tart'|'clos-de-vougeot'|'clos-des-lambrays'|'clos-saint-denis'|'echezeaux'|'grands-echezeaux'|'la-grande-rue'|'la-romanee'|'la-tache'|'musigny'|'richebourg'|'romanee-conti'|'romanee-saint-vivant';

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
 {slug:"bonnes-mares",name:"Bonnes-Mares",parentFeatureId:"inao-denom-361",villageMaps:["chambolle-musigny", "morey-saint-denis"],bundle:"chambolle-morey",evidenceFrom:["bonnes-mares"],domaineGrouping:false},
 {slug:"clos-de-tart",name:"Clos de Tart",parentFeatureId:"inao-denom-545",villageMaps:["morey-saint-denis"],bundle:"chambolle-morey",evidenceFrom:["clos-de-tart"],domaineGrouping:false},
 {slug:"clos-de-vougeot",name:"Clos de Vougeot",parentFeatureId:"inao-denom-546",villageMaps:["vougeot"],bundle:"vougeot",evidenceFrom:["clos-de-vougeot"],domaineGrouping:false},
 {slug:"clos-des-lambrays",name:"Clos des Lambrays",parentFeatureId:"inao-denom-547",villageMaps:["morey-saint-denis"],bundle:"chambolle-morey",evidenceFrom:["clos-des-lambrays"],domaineGrouping:false},
 {slug:"clos-saint-denis",name:"Clos Saint-Denis",parentFeatureId:"inao-denom-548",villageMaps:["morey-saint-denis"],bundle:"chambolle-morey",evidenceFrom:["clos-saint-denis"],domaineGrouping:false},
 {slug:"echezeaux",name:"Échezeaux",parentFeatureId:"inao-denom-565",villageMaps:["vosne-romanee"],bundle:"flagey-echezeaux",evidenceFrom:["echezeaux"],domaineGrouping:true},
 {slug:"grands-echezeaux",name:"Grands-Échezeaux",parentFeatureId:"inao-denom-645",villageMaps:["vosne-romanee"],bundle:"flagey-echezeaux",evidenceFrom:["grands-echezeaux"],domaineGrouping:true},
 {slug:"la-grande-rue",name:"La Grande Rue",parentFeatureId:"inao-denom-654",villageMaps:["vosne-romanee"],bundle:"vosne-romanee",evidenceFrom:["la-grande-rue"],domaineGrouping:false},
 {slug:"la-romanee",name:"La Romanée",parentFeatureId:"inao-denom-655",villageMaps:["vosne-romanee"],bundle:"vosne-romanee",evidenceFrom:["la-romanee"],domaineGrouping:false},
 {slug:"la-tache",name:"La Tâche",parentFeatureId:"inao-denom-656",villageMaps:["vosne-romanee"],bundle:"vosne-romanee",evidenceFrom:["la-tache"],domaineGrouping:false},
 {slug:"musigny",name:"Musigny",parentFeatureId:"inao-denom-973",villageMaps:["chambolle-musigny"],bundle:"chambolle-morey",evidenceFrom:["musigny"],domaineGrouping:false},
 {slug:"richebourg",name:"Richebourg",parentFeatureId:"inao-denom-1083",villageMaps:["vosne-romanee"],bundle:"vosne-romanee",evidenceFrom:["richebourg"],domaineGrouping:false},
 {slug:"romanee-conti",name:"Romanée-Conti",parentFeatureId:"inao-denom-1084",villageMaps:["vosne-romanee"],bundle:"vosne-romanee",evidenceFrom:["romanee-conti"],domaineGrouping:false},
 {slug:"romanee-saint-vivant",name:"Romanée-Saint-Vivant",parentFeatureId:"inao-denom-1085",villageMaps:["vosne-romanee"],bundle:"vosne-romanee",evidenceFrom:["romanee-saint-vivant"],domaineGrouping:false},
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
