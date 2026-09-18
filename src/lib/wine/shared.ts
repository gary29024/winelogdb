export type SharedWineExperience={
 tastingNotes:string;
 rating:number|null;
 tastingDate:string|null;
 tastingName:string|null;
 venue:string|null;
 locationName:string|null;
 price:number|null;
 currency:string|null;
};

/** Shared identity/facts plus the current viewer's own experience. Source-owner
 * journal fields are never copied into the recipient's experience. */
export type SharedWine = SharedWineExperience&{
 id:string;
 ownerName:string;
 producer:string;
 wineName:string;
 vintage:number|null;
 country:string|null;
 region:string|null;
 appellation:string|null;
 wineStyle:string|null;
 grapes:string[];
 classification:'grand_cru'|'premier_cru'|'village'|null;
 alcoholPercentage:number|null;
 favorite:boolean;
 updatedAt:string;
 photos?:Array<{id:string;url:string}>;
};
