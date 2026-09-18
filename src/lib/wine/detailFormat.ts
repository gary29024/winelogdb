/**
 * Formatting shared by the two wine detail pages. Each page had grown its own
 * copy of formatPrice with different empty-value handling, which is how the
 * owner view ended up printing a raw 2026-09-18 while the Passport beside it
 * printed 18 Sep 2026. One implementation, one answer on both.
 */

/** Empty rather than null, so a caller filtering on truthiness drops it either way. */
export function formatPrice(price:number|null|undefined,currency:string|null|undefined){
  if(price==null)return '';
  const amount=new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(price);
  return currency?`${currency} ${amount}`:amount;
}

/**
 * A stored tasting date is a calendar day, not an instant. Parsed at local
 * midnight so a UTC-negative offset cannot show the day before, matching how
 * the Passport reads the same field.
 */
export function formatDate(value:string|null|undefined){
  if(!value)return '';
  const date=new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ?value
    :new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(date);
}

/** A score is the taster's own, so it is labelled as theirs wherever it is shown. */
export function formatRating(rating:number|null|undefined){
  return rating==null?'':`${rating} / 100`;
}
