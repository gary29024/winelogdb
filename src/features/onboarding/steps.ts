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
 /**
  * Go here before showing the step. This is what a chapter is for and the
  * first run is not: the first run explains the chrome, which is on screen
  * everywhere, while a chapter's whole job is to take you somewhere you had not
  * found and talk about it once you are there.
  */
 route?:string;
};

export type Tour={id:string;label:string;blurb:string;steps:TourStep[]};

export const FIRST_RUN='first-run';
/** Shown once, in the credit confirmation, the first time a member is charged. */
export const CREDITS_INTRO='credits-intro';

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


export const firstRun:Tour={id:FIRST_RUN,label:'Where everything lives',blurb:'The six-minute version of the whole app.',steps:firstRunSteps};

/**
 * The optional chapters, offered from Account & friends.
 *
 * Each one is about a part of the app a phone cannot reach from the tab bar -
 * which is the whole reason they exist. A chapter takes you to the page first
 * and then talks, because being shown the way there is most of the value; the
 * first-run tour never navigates, because the chrome it describes is already on
 * every screen.
 *
 * There is deliberately no "adding wine" chapter. The scan sheet already
 * explains its four modes in its own copy, every time it is opened, and a
 * chapter would have had to prise that sheet open and then fight it for the
 * layer it sits on. Repeating a good explanation worse is not worth the
 * machinery.
 */
export const chapters:Tour[]=[
 {
  id:'chapter-tastings',label:'Tastings',blurb:'Evenings, and how wines join them.',
  steps:[
   {
    id:'tastings-page',route:'/tastings',
    title:'Every evening in one place',
    body:'A tasting is a container for one sitting - a dinner, a flight, a visit to a domaine. Past ones are listed here, newest first. On a phone this page has no tab of its own, which is why it is easy to miss.'
   },
   {
    id:'tastings-start',anchor:'scan-trigger',
    title:'Starting one',
    body:'Scan Wine, then Start Tasting. Name it and give it a venue once, and you will not be asked again for that evening.'
   },
   {
    id:'tastings-live',
    title:'While it is running',
    body:'A strip appears at the top of every page, and every wine you log joins the open tasting by itself. You never have to attach bottles to an evening one at a time.'
   }
  ]
 },
 {
  id:'chapter-sharing',label:'Friends and sharing',blurb:'Friend codes, and who sees which wine.',
  steps:[
   {
    id:'sharing-account',anchor:'nav-account',route:'/account',
    title:'Friends live here',
    body:'Account & friends is where you add people and see who you are connected to. On a phone it sits in the top bar rather than the tab bar.'
   },
   {
    id:'sharing-codes',route:'/account',
    title:'Friend codes',
    body:'You add someone by entering their friend code, and they confirm it. Being friends lets you reuse each other\u2019s factual research about producers and vintages. It does not hand over your Journal.'
   },
   {
    id:'sharing-wines',route:'/account',
    title:'Sharing is per wine',
    body:'A bottle is shared by tagging a friend on it, one at a time, or by turning on default tagging for that friend. Whatever they have been shown arrives in their Shared list - and nothing else does.'
   }
  ]
 },
 {
  id:'chapter-progress',label:'Stamps and collections',blurb:'What the Passport is counting.',
  steps:[
   {
    id:'progress-passport',anchor:'nav-passport',route:'/',
    title:'What the Passport counts',
    body:'Wines, producers, regions, countries and vintages, all counted from your Journal. There is nothing to fill in: it moves when you log a bottle.'
   },
   {
    id:'progress-collections',route:'/achievements',anchor:'collections',
    title:'Collections',
    body:'Checklists of bottles worth chasing - curated editions, and any you build yourself. Progress ticks over on its own as matching wines land in your Journal.'
   },
   {
    id:'progress-stamps',
    title:'Stamps',
    body:'Milestones at 10, 25, 50 wines and upward, across several tracks. The Passport shows the one you are closest to rather than all of them at once.'
   }
  ]
 }
];

export const allTours=[firstRun,...chapters];
export const tourById=(id:string)=>allTours.find(tour=>tour.id===id);

const matches=(step:TourStep,role:'owner'|'member',mobile:boolean)=>
 (!step.roles||step.roles.includes(role))&&(!step.viewport||(step.viewport==='mobile')===mobile);

/** The steps this account, on this screen, should actually be shown. */
export const stepsFor=(steps:TourStep[],role:'owner'|'member',mobile:boolean)=>steps.filter(step=>matches(step,role,mobile));
