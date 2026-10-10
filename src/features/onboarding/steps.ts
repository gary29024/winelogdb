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
  body:'The Journal is the record of what you have tasted. Bottles you own but have not opened yet are also in here, under the In cellar tab at the top of the page - the cellar is not a separate section.'
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
  body:'Producers builds itself from your Journal - everyone whose wine you log appears, and you never add one by hand. Vintages is the other way round: a season-by-season record of each village that is already complete, with your own bottles marked on it.'
 },
 {
  id:'nav-account',anchor:'nav-account',
  title:'Friends and sharing',
  body:'The circle with your initial opens your account, your friends, and what you share with them. Sharing is per wine and separate from being friends: adding a friend does not hand over your Journal, and you choose which bottles they see.'
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
  id:'chapter-journal',label:'The Journal',blurb:'Scopes, searching, and working on several wines at once.',
  steps:[
   {
    id:'journal-scopes',route:'/journal',anchor:'journal-scopes',
    title:'One page, three scopes',
    body:'Tasted is what you have drunk, In cellar is what you still hold, and Favorites is what you starred. The page shows one at a time on purpose: a bottle in the cellar is not a tasting note until you open it.'
   },
   {
    id:'journal-search',route:'/journal',anchor:'journal-search',
    title:'Two kinds of search',
    body:'A few words match names, producers and regions as you type, and costs nothing. Describe a wine instead - a rounded red for a cold evening - and a Smart search button appears. That one matches on meaning rather than spelling, so it waits until you press it or hit Enter.'
   },
   {
    id:'journal-filters',route:'/journal',anchor:'journal-filters',
    title:'Narrowing down',
    body:'Country, producer, vintage, style, score, month, the tasting it came from, and whether it has been researched. They stack, so you can ask for 2016 Burgundy you rated above 90. Clear filters puts it all back.'
   },
   {
    id:'journal-select',route:'/journal',anchor:'journal-select',
    title:'Several wines at once',
    body:'Select turns the list into checkboxes. From there you can tag a friend on a whole evening, build a share card from the bottles you choose, or set the event and venue for all of them in one go.'
   }
  ]
 },
 {
  id:'chapter-vintages',label:'Vintages',blurb:'Reading a season, village by village.',
  steps:[
   {
    id:'vintages-page',route:'/vintages',anchor:'vintage-village',
    title:'A record of the seasons',
    body:'Unlike the rest of the app, this page does not wait for you: the weather of each village is already here. Pick a region and a village, and it shows how every year since the 1990s actually went.'
   },
   {
    id:'vintages-strip',route:'/vintages',anchor:'vintage-strip',
    title:'Years at a glance',
    body:'One tile per year, shaded by when picking started - warm early seasons at one end, cool late ones at the other. A small glass marks the years you own wine from. Tap any tile to read that season.'
   },
   {
    id:'vintages-key',route:'/vintages',anchor:'vintage-key',
    title:'What the marks mean',
    body:'Warmth, Rain and Nights each carry an arrow for how far the year sat from normal, and How unusual says how far that is overall. Compare with lets you judge a year against its own era or against a fixed standard, which matters once decades of warming are in the picture.'
   }
  ]
 },
 {
  id:'chapter-sharing',label:'Friends and sharing',blurb:'Friend codes, and who sees which wine.',
  steps:[
   {
    id:'sharing-account',anchor:'nav-account',route:'/account',
    title:'Friends live here',
    body:'The circle with your initial, top right, is Account & friends: where you add people and see who you are connected to. It sits in the top bar on every screen rather than in the tab bar.'
   },
   {
    id:'sharing-codes',route:'/account',
    title:'User IDs and friend codes',
    body:'Every account has a user ID like @yourname, picked for you at sign-in and yours to change. You add someone by typing their user ID or their friend code, and they confirm it. Being friends lets you reuse each other\u2019s factual research about producers and vintages. It does not hand over your Journal.'
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
