/**
 * The first-run tour, as data.
 *
 * Every step points at a real element by its `data-tour` attribute rather than
 * by class or position: the nav has been restyled more than once, and an anchor
 * that survives a restyle is the difference between a tour that keeps working
 * and one that silently points at nothing. tests/unit/tourAnchors.test.ts fails
 * if an anchor named here is missing from the app.
 *
 * Wording lives here and only here, so it can be rewritten without touching the
 * overlay.
 */
export type TourStep={
 id:string;
 /** data-tour value of the element to spotlight. Omitted: a centred card. */
 anchor?:string;
 title:string;
 body:string;
 /** Omitted: everyone. The owner is bill-direct, so credit talk is members-only. */
 roles?:Array<'owner'|'member'>;
 /** Omitted: both. The top bar and the bottom bar do not hold the same items. */
 viewport?:'mobile'|'desktop';
};

export const FIRST_RUN='first-run';

/**
 * Seven steps on a desktop, six on a phone, all anchored to the persistent
 * chrome rather than to a page - which is why the tour needs no route changes
 * and cannot be stranded by one: wherever someone navigates mid-tour, every
 * remaining anchor is still on screen.
 *
 * Only the Tastings step is viewport-specific, and for a real reason: the top
 * bar carries a Tastings link and the five-slot tab bar has no room for one, so
 * on a phone the subject is covered by Start Tasting inside the scan sheet
 * instead. Passport, Journal and Producers appear in both navs under the same
 * anchor name, and the engine spotlights whichever copy is on screen.
 *
 * The cellar sentence in `nav-journal` is the single most valuable line in here.
 * A bottle you own but have not opened lives at /journal?scope=cellar, and
 * nothing on first sight says so - it is the question new users ask first.
 */
export const firstRunSteps:TourStep[]=[
 {
  id:'nav-passport',anchor:'nav-passport',
  title:'Your Passport',
  body:'The map, stamps and progress of everything you have drunk. It starts empty and fills itself in as you log wines - you never have to maintain it.'
 },
 {
  id:'nav-journal',anchor:'nav-journal',
  title:'Every wine you log',
  body:'The Journal is the record of what you have tasted. Bottles you own but have not opened yet are also in here, under the Cellar tab at the top of the page - the cellar is not a separate section.'
 },
 {
  id:'scan',anchor:'scan-trigger',
  title:'One button, four ways in',
  body:'Scan Wine opens a sheet holding Single Wine, Group Photo, Batch Scan and Start Tasting - one bottle, a lineup photo, a big batch, or an evening with friends. The sheet explains each one, and you can always add a wine by hand instead.'
 },
 {
  id:'nav-tastings',anchor:'nav-tastings',viewport:'desktop',
  title:'Tastings',
  body:'An evening is a container: open one, and every wine you log while it is running joins it. This is where past evenings live.'
 },
 {
  id:'nav-producers',anchor:'nav-producers',
  title:'Producers and Vintages',
  body:'Background on who made the wine and how a given year turned out. Both build themselves from your Journal, so they grow as you log - there is nothing to fill in.'
 },
 {
  id:'nav-account',anchor:'nav-account',
  title:'Friends and sharing',
  body:'Your account, your friends, and what you share with them. Sharing is per wine and separate from being friends: adding a friend does not hand over your Journal, and you choose which bottles they see.'
 },
 {
  id:'tour-done',
  title:'That is the tour',
  body:'Add your first bottle whenever you like - the Journal and Passport will tell you what they need. You can run this tour again from Account & friends.'
 }
];

const matches=(step:TourStep,role:'owner'|'member',mobile:boolean)=>
 (!step.roles||step.roles.includes(role))&&(!step.viewport||(step.viewport==='mobile')===mobile);

/** The steps this account, on this screen, should actually be shown. */
export const stepsFor=(steps:TourStep[],role:'owner'|'member',mobile:boolean)=>steps.filter(step=>matches(step,role,mobile));
