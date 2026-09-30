import flageyEchezeaux from './flagey-echezeaux.manifest.json';

/** A commune bundle's parcel file and rights snapshot, built by scripts/build_grand_cru_parcels.py. */
export type ParcelManifest=typeof flageyEchezeaux;

// One entry per scripts/grand-crus/bundles/<id>.json. A bundle serves every cru in its communes,
// so several crus share one parcel download (Flagey serves Échezeaux and Grands-Échezeaux).
export const parcelBundles={'flagey-echezeaux':flageyEchezeaux} satisfies Record<string,ParcelManifest>;
export type ParcelBundleId=keyof typeof parcelBundles;

/** Crus whose research files feed the evidence panel; see ./evidence.ts. */
export type EvidenceSourceId='echezeaux'|'grands-echezeaux';

export type GrandCru={
 slug:string;name:string;parentFeatureId:string;
 /** Village map (burgundyVillageMapRegistry id) that shows this cru's parcels. */
 villageMap:string;bundle:ParcelBundleId;
 /** Research evidence files read by the panel and domaine grouping; empty until the cru has research. */
 evidenceFrom:EvidenceSourceId[];
};

// Mirrors scripts/grand-crus/<slug>.json (checked by tests/unit/grandCruRegistry.test.ts).
// Components look crus up here; they never name a cru or INAO feature themselves.
export const grandCrus:readonly GrandCru[]=[
 {slug:'echezeaux',name:'Échezeaux',parentFeatureId:'inao-denom-565',villageMap:'vosne-romanee',bundle:'flagey-echezeaux',evidenceFrom:['echezeaux']},
 {slug:'grands-echezeaux',name:'Grands-Échezeaux',parentFeatureId:'inao-denom-645',villageMap:'vosne-romanee',bundle:'flagey-echezeaux',evidenceFrom:['grands-echezeaux']},
];

/** The cru with parcel rights for this INAO feature, optionally only on a given village map. */
export function grandCruFor(parentFeatureId:string,villageMap?:string){
 return grandCrus.find(cru=>cru.parentFeatureId===parentFeatureId&&(!villageMap||cru.villageMap===villageMap));
}

export function parcelManifestFor(parentFeatureId:string):ParcelManifest|undefined{
 const cru=grandCruFor(parentFeatureId);
 return cru&&parcelBundles[cru.bundle];
}
