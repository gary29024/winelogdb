/** The complete shared-wine contract. Private journal fields never belong here. */
export type SharedWine = {
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
 tastingNotes:string;
 rating:number|null;
 tastingDate:string|null;
 updatedAt:string;
 photos?:Array<{id:string;url:string}>;
};
