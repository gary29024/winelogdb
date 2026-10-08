import bundle0 from './chablis.manifest.json';
import bundle1 from './chambolle-morey.manifest.json';
import bundle2 from './corton.manifest.json';
import bundle3 from './flagey-echezeaux.manifest.json';
import bundle4 from './gevrey-chambertin.manifest.json';
import bundle5 from './montrachet.manifest.json';
import bundle6 from './vosne-romanee.manifest.json';
import bundle7 from './vougeot.manifest.json';

/** A commune bundle's parcel file and rights snapshot, built by scripts/build_grand_cru_parcels.py. */
export type ParcelManifest=typeof bundle0;

// One entry per scripts/grand-crus/bundles/<id>.json. A bundle serves every cru in its communes,
// so several crus share one parcel download (Flagey serves Échezeaux and Grands-Échezeaux).
export const parcelBundles={'chablis':bundle0,'chambolle-morey':bundle1,'corton':bundle2,'flagey-echezeaux':bundle3,'gevrey-chambertin':bundle4,'montrachet':bundle5,'vosne-romanee':bundle6,'vougeot':bundle7} satisfies Record<string,ParcelManifest>;
export type ParcelBundleId=keyof typeof parcelBundles;

/** Crus whose research files feed the evidence panel; see ./evidence.ts. */
export type EvidenceSourceId='batard-montrachet'|'bienvenues-batard-montrachet'|'bonnes-mares'|'chablis-grand-cru'|'chambertin'|'chambertin-clos-de-beze'|'chapelle-chambertin'|'charlemagne'|'charmes-chambertin'|'chevalier-montrachet'|'clos-de-la-roche'|'clos-de-tart'|'clos-de-vougeot'|'clos-des-lambrays'|'clos-saint-denis'|'corton'|'corton-charlemagne'|'criots-batard-montrachet'|'echezeaux'|'grands-echezeaux'|'griotte-chambertin'|'la-grande-rue'|'la-romanee'|'la-tache'|'latricieres-chambertin'|'mazis-chambertin'|'mazoyeres-chambertin'|'montrachet'|'musigny'|'richebourg'|'romanee-conti'|'romanee-saint-vivant'|'ruchottes-chambertin';

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
 {slug:"batard-montrachet",name:"Bâtard-Montrachet",parentFeatureId:"inao-denom-273",villageMaps:["chassagne-montrachet", "puligny-montrachet"],bundle:"montrachet",evidenceFrom:["batard-montrachet"],domaineGrouping:false},
 {slug:"bienvenues-batard-montrachet",name:"Bienvenues-Bâtard-Montrachet",parentFeatureId:"inao-denom-351",villageMaps:["puligny-montrachet"],bundle:"montrachet",evidenceFrom:["bienvenues-batard-montrachet"],domaineGrouping:false},
 {slug:"bonnes-mares",name:"Bonnes-Mares",parentFeatureId:"inao-denom-361",villageMaps:["chambolle-musigny", "morey-saint-denis"],bundle:"chambolle-morey",evidenceFrom:["bonnes-mares"],domaineGrouping:false},
 {slug:"chablis-grand-cru",name:"Chablis Grand Cru",parentFeatureId:"inao-denom-439",villageMaps:["chablis"],bundle:"chablis",evidenceFrom:["chablis-grand-cru"],domaineGrouping:false},
 {slug:"chambertin",name:"Chambertin",parentFeatureId:"inao-denom-447",villageMaps:["gevrey-chambertin"],bundle:"gevrey-chambertin",evidenceFrom:["chambertin"],domaineGrouping:false},
 {slug:"chambertin-clos-de-beze",name:"Chambertin-Clos de Bèze",parentFeatureId:"inao-denom-448",villageMaps:["gevrey-chambertin"],bundle:"gevrey-chambertin",evidenceFrom:["chambertin-clos-de-beze"],domaineGrouping:false},
 {slug:"chapelle-chambertin",name:"Chapelle-Chambertin",parentFeatureId:"inao-denom-475",villageMaps:["gevrey-chambertin"],bundle:"gevrey-chambertin",evidenceFrom:["chapelle-chambertin"],domaineGrouping:false},
 {slug:"charlemagne",name:"Charlemagne",parentFeatureId:"inao-denom-476",villageMaps:["aloxe-corton", "ladoix", "pernand-vergelesses"],bundle:"corton",evidenceFrom:["charlemagne"],domaineGrouping:false},
 {slug:"charmes-chambertin",name:"Charmes-Chambertin",parentFeatureId:"inao-denom-477",villageMaps:["gevrey-chambertin"],bundle:"gevrey-chambertin",evidenceFrom:["charmes-chambertin"],domaineGrouping:false},
 {slug:"chevalier-montrachet",name:"Chevalier-Montrachet",parentFeatureId:"inao-denom-539",villageMaps:["puligny-montrachet"],bundle:"montrachet",evidenceFrom:["chevalier-montrachet"],domaineGrouping:false},
 {slug:"clos-de-la-roche",name:"Clos de la Roche",parentFeatureId:"inao-denom-544",villageMaps:["morey-saint-denis"],bundle:"chambolle-morey",evidenceFrom:["clos-de-la-roche"],domaineGrouping:false},
 {slug:"clos-de-tart",name:"Clos de Tart",parentFeatureId:"inao-denom-545",villageMaps:["morey-saint-denis"],bundle:"chambolle-morey",evidenceFrom:["clos-de-tart"],domaineGrouping:false},
 {slug:"clos-de-vougeot",name:"Clos de Vougeot",parentFeatureId:"inao-denom-546",villageMaps:["vougeot"],bundle:"vougeot",evidenceFrom:["clos-de-vougeot"],domaineGrouping:true},
 {slug:"clos-des-lambrays",name:"Clos des Lambrays",parentFeatureId:"inao-denom-547",villageMaps:["morey-saint-denis"],bundle:"chambolle-morey",evidenceFrom:["clos-des-lambrays"],domaineGrouping:false},
 {slug:"clos-saint-denis",name:"Clos Saint-Denis",parentFeatureId:"inao-denom-548",villageMaps:["morey-saint-denis"],bundle:"chambolle-morey",evidenceFrom:["clos-saint-denis"],domaineGrouping:false},
 {slug:"corton",name:"Corton",parentFeatureId:"inao-denom-549",villageMaps:["aloxe-corton", "ladoix", "pernand-vergelesses"],bundle:"corton",evidenceFrom:["corton"],domaineGrouping:true},
 {slug:"corton-charlemagne",name:"Corton-Charlemagne",parentFeatureId:"inao-denom-550",villageMaps:["aloxe-corton", "ladoix", "pernand-vergelesses"],bundle:"corton",evidenceFrom:["corton-charlemagne"],domaineGrouping:false},
 {slug:"criots-batard-montrachet",name:"Criots-Bâtard-Montrachet",parentFeatureId:"inao-denom-564",villageMaps:["chassagne-montrachet"],bundle:"montrachet",evidenceFrom:["criots-batard-montrachet"],domaineGrouping:false},
 {slug:"echezeaux",name:"Échezeaux",parentFeatureId:"inao-denom-565",villageMaps:["vosne-romanee"],bundle:"flagey-echezeaux",evidenceFrom:["echezeaux"],domaineGrouping:true},
 {slug:"grands-echezeaux",name:"Grands-Échezeaux",parentFeatureId:"inao-denom-645",villageMaps:["vosne-romanee"],bundle:"flagey-echezeaux",evidenceFrom:["grands-echezeaux"],domaineGrouping:true},
 {slug:"griotte-chambertin",name:"Griotte-Chambertin",parentFeatureId:"inao-denom-646",villageMaps:["gevrey-chambertin"],bundle:"gevrey-chambertin",evidenceFrom:["griotte-chambertin"],domaineGrouping:false},
 {slug:"la-grande-rue",name:"La Grande Rue",parentFeatureId:"inao-denom-654",villageMaps:["vosne-romanee"],bundle:"vosne-romanee",evidenceFrom:["la-grande-rue"],domaineGrouping:false},
 {slug:"la-romanee",name:"La Romanée",parentFeatureId:"inao-denom-655",villageMaps:["vosne-romanee"],bundle:"vosne-romanee",evidenceFrom:["la-romanee"],domaineGrouping:true},
 {slug:"la-tache",name:"La Tâche",parentFeatureId:"inao-denom-656",villageMaps:["vosne-romanee"],bundle:"vosne-romanee",evidenceFrom:["la-tache"],domaineGrouping:false},
 {slug:"latricieres-chambertin",name:"Latricières-Chambertin",parentFeatureId:"inao-denom-666",villageMaps:["gevrey-chambertin"],bundle:"gevrey-chambertin",evidenceFrom:["latricieres-chambertin"],domaineGrouping:false},
 {slug:"mazis-chambertin",name:"Mazis-Chambertin",parentFeatureId:"inao-denom-808",villageMaps:["gevrey-chambertin"],bundle:"gevrey-chambertin",evidenceFrom:["mazis-chambertin"],domaineGrouping:false},
 {slug:"mazoyeres-chambertin",name:"Mazoyères-Chambertin",parentFeatureId:"inao-denom-809",villageMaps:["gevrey-chambertin"],bundle:"gevrey-chambertin",evidenceFrom:["mazoyeres-chambertin"],domaineGrouping:false},
 {slug:"montrachet",name:"Montrachet",parentFeatureId:"inao-denom-927",villageMaps:["chassagne-montrachet", "puligny-montrachet"],bundle:"montrachet",evidenceFrom:["montrachet"],domaineGrouping:false},
 {slug:"musigny",name:"Musigny",parentFeatureId:"inao-denom-973",villageMaps:["chambolle-musigny"],bundle:"chambolle-morey",evidenceFrom:["musigny"],domaineGrouping:false},
 {slug:"richebourg",name:"Richebourg",parentFeatureId:"inao-denom-1083",villageMaps:["vosne-romanee"],bundle:"vosne-romanee",evidenceFrom:["richebourg"],domaineGrouping:true},
 {slug:"romanee-conti",name:"Romanée-Conti",parentFeatureId:"inao-denom-1084",villageMaps:["vosne-romanee"],bundle:"vosne-romanee",evidenceFrom:["romanee-conti"],domaineGrouping:true},
 {slug:"romanee-saint-vivant",name:"Romanée-Saint-Vivant",parentFeatureId:"inao-denom-1085",villageMaps:["vosne-romanee"],bundle:"vosne-romanee",evidenceFrom:["romanee-saint-vivant"],domaineGrouping:true},
 {slug:"ruchottes-chambertin",name:"Ruchottes-Chambertin",parentFeatureId:"inao-denom-1086",villageMaps:["gevrey-chambertin"],bundle:"gevrey-chambertin",evidenceFrom:["ruchottes-chambertin"],domaineGrouping:false},
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
