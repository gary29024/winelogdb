import { test,expect,type Page } from '@playwright/test';

/**
 * The spotlight has to land on whichever nav is actually on screen.
 *
 * Passport, Journal and Producers appear twice in the markup - once in the top
 * bar, once in the tab bar - under one anchor name each, and at any width
 * exactly one of the pair is rendered. jsdom lays nothing out, so it cannot
 * tell the two apart; only a real browser can say whether the ring ended up
 * around the item the user can see.
 */
/** An untouched journal - which is exactly what a newly invited member has. */
const emptyJourney={
 summary:{totalWines:0,producers:0,countries:0,regions:0,appellations:0,vintages:0,favorites:0,averageRating:null,ratedWines:0,pricedWines:0,structuredTastings:0},
 countries:[],regions:[],appellations:[],styles:[],producers:[],currencies:[],years:[],structures:[],grapes:[],
 discovery:{tastings:0,newProducers:0,newRegions:0,newCountries:0},
 months:[],classifications:[],drinkingAges:[],recentTastings:[]
};

/** Signs a reader in, and hands back the writes this page makes to /api/me/tour. */
async function signedIn(page:Page,tourState='{}'){
 const saved:Array<Record<string,unknown>>=[];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/me/tour'){saved.push(JSON.parse(route.request().postData()??'{}'));await route.fulfill({json:{user:{id:'reader',tour_state:'{}'}}});return}
  const data=path==='/api/me'?{user:{id:'reader',email:'reader@example.com',display_name:'Reader',role:'member',status:'active',tour_state:tourState}}
   :path==='/api/journey'?emptyJourney
   :path==='/api/achievements'?[]
   // Account & friends, where the chapters are started from.
   :path==='/api/friends/requests'?{incoming:[],outgoing:[]}
   :path==='/api/friends/code'?{code:'ABCD-EFGH'}
   :path==='/api/usage/spend'?{days:30,kinds:[],empty:true}
   :path==='/api/credits'?{balance:20,reserved:0,available:20,sponsoredAi:true,actionAccess:[]}
   :{items:[],holdings:[],total:0};
  await route.fulfill({json:data});
 });
 return saved;
}
const bubble=(page:Page)=>page.getByRole('dialog');
const spotlight=(page:Page)=>page.locator('.tour-spotlight');

/**
 * That the spotlight has come to rest around the element it should be ringing.
 *
 * Retried rather than measured once: the ring glides between anchors on a CSS
 * transition, so a single measurement taken just after Next catches it
 * somewhere between the old position and the new one. What matters is where it
 * settles.
 */
async function rings(page:Page,anchor:string){
 const visible=page.locator(`[data-tour="${anchor}"]:visible`);
 await expect(visible,`exactly one ${anchor} should be on screen at this width`).toHaveCount(1);
 await expect(async()=>{
  const ring=await spotlight(page).boundingBox();
  const target=await visible.boundingBox();
  expect(ring,'the spotlight should be drawn').toBeTruthy();
  expect(target,'the anchor should have a box').toBeTruthy();
  // The ring is drawn 6px outside the element on every side.
  expect(Math.abs(ring!.x+6-target!.x),`${anchor} left`).toBeLessThan(2);
  expect(Math.abs(ring!.y+6-target!.y),`${anchor} top`).toBeLessThan(2);
  expect(Math.abs(ring!.width-12-target!.width),`${anchor} width`).toBeLessThan(2);
  expect(Math.abs(ring!.height-12-target!.height),`${anchor} height`).toBeLessThan(2);
 }).toPass({timeout:4000});
}

test.describe('the first-run tour on a desktop',()=>{
 test.use({viewport:{width:1280,height:900}});

 test('rings the top bar, walks seven steps, and records the finish',async({page})=>{
  const saved=await signedIn(page);
  await page.goto('/');
  await expect(bubble(page)).toContainText('Step 1 of 7');
  await rings(page,'nav-passport');

  await page.getByRole('button',{name:'Next'}).click();
  await expect(bubble(page)).toContainText('In cellar tab');
  await rings(page,'nav-journal');

  for(const step of ['One button, four ways in','Tastings','Producers and Vintages','Friends and sharing','That is the tour']){
   await page.getByRole('button',{name:'Next'}).click();
   await expect(bubble(page)).toContainText(step);
  }
  // The closing card points at nothing, so there is no ring to draw.
  await expect(spotlight(page)).toHaveCount(0);
  await page.getByRole('button',{name:'Done'}).click();
  await expect(bubble(page)).toHaveCount(0);
  await expect.poll(()=>saved).toEqual([{completed:['first-run'],skipped:false}]);
 });

 test('stays away from someone who has already seen it',async({page})=>{
  await signedIn(page,'{"completed":["first-run"],"skipped":false}');
  await page.goto('/');
  await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
  await expect(bubble(page)).toHaveCount(0);
 });
});

test.describe('the first-run tour on a phone',()=>{
 test.use({viewport:{width:390,height:844}});

 test('rings the tab bar instead, and drops the step the tab bar has no room for',async({page})=>{
  await signedIn(page);
  await page.goto('/');
  // Six, not seven: there is no Tastings tab to point at on a phone.
  await expect(bubble(page)).toContainText('Step 1 of 6');
  await rings(page,'nav-passport');
  // ...and the item being ringed is the one in the bottom bar.
  const ringed=page.locator('nav.mobile-nav [data-tour="nav-passport"]');
  await expect(ringed).toBeVisible();

  await page.getByRole('button',{name:'Next'}).click();
  await expect(bubble(page)).toContainText('In cellar tab');
  await rings(page,'nav-journal');

  await page.getByRole('button',{name:'Next'}).click();
  await expect(bubble(page)).toContainText('One button, four ways in');
  await rings(page,'scan-trigger');
  // Tastings is skipped here, so Producers comes next.
  await page.getByRole('button',{name:'Next'}).click();
  await expect(bubble(page)).toContainText('Producers and Vintages');
 });

 test('keeps the bubble inside the screen at every step',async({page})=>{
  await signedIn(page);
  await page.goto('/');
  for(let step=1;step<=6;step++){
   const box=await bubble(page).boundingBox();
   expect(box,`step ${step} should have a bubble`).toBeTruthy();
   expect(box!.x,`step ${step} runs off the left`).toBeGreaterThanOrEqual(-1);
   expect(box!.x+box!.width,`step ${step} runs off the right`).toBeLessThanOrEqual(391);
   expect(box!.y,`step ${step} runs off the top`).toBeGreaterThanOrEqual(-1);
   expect(box!.y+box!.height,`step ${step} runs off the bottom`).toBeLessThanOrEqual(845);
   if(step<6)await page.getByRole('button',{name:'Next'}).click();
  }
 });

 test('can be skipped, and does not come back',async({page})=>{
  const saved=await signedIn(page);
  await page.goto('/');
  await page.getByRole('button',{name:'Skip tour'}).click();
  await expect(bubble(page)).toHaveCount(0);
  await expect.poll(()=>saved).toEqual([{completed:[],skipped:true}]);
 });
});

/**
 * A chapter is the only part of the tour that navigates, and route changes are
 * the one thing jsdom genuinely cannot stand in for: the page arrives as a
 * lazily loaded chunk, so the anchor the next step wants does not exist at the
 * moment the step asks for it.
 */
test.describe('an optional chapter',()=>{
 test.use({viewport:{width:390,height:844}});

 test('is started from Account & friends and takes you to the page it is about',async({page})=>{
  const saved=await signedIn(page,'{"completed":["first-run"],"skipped":false}');
  await page.goto('/account');
  await expect(bubble(page)).toHaveCount(0);

  await page.getByRole('button',{name:/Tastings/}).click();
  await expect(bubble(page)).toContainText('Tastings · Step 1 of 3');
  // The chapter navigated: this page has no tab of its own on a phone.
  await expect(page).toHaveURL(/\/tastings$/);
  // Level 1: the page's own title, not the nav link or a section of the same name.
  await expect(page.getByRole('heading',{name:'Tastings',level:1})).toBeVisible();

  await page.getByRole('button',{name:'Next'}).click();
  await expect(bubble(page)).toContainText('Scan Wine, then Start Tasting');
  await rings(page,'scan-trigger');

  await page.getByRole('button',{name:'Next'}).click();
  await page.getByRole('button',{name:'Done'}).click();
  await expect.poll(()=>saved).toEqual([{completed:['first-run','chapter-tastings'],skipped:false}]);
 });

 test('waits for a lazily loaded page before pointing at something on it',async({page})=>{
  await signedIn(page,'{"completed":["first-run"],"skipped":false}');
  await page.goto('/account');
  await page.getByRole('button',{name:/Stamps and collections/}).click();
  await expect(bubble(page)).toContainText('What the Passport counts');
  await rings(page,'nav-passport');

  // Step two crosses to /achievements and rings a section of that page, which
  // does not exist until the route's chunk has loaded and rendered.
  await page.getByRole('button',{name:'Next'}).click();
  await expect(page).toHaveURL(/\/achievements$/);
  await expect(bubble(page)).toContainText('Collections');
  await rings(page,'collections');
 });

 test('leaves no mark when it is closed part-way',async({page})=>{
  const saved=await signedIn(page,'{"completed":["first-run"],"skipped":false}');
  await page.goto('/account');
  await page.getByRole('button',{name:/Friends and sharing/}).click();
  await expect(bubble(page)).toContainText('Friends live here');
  await page.getByRole('button',{name:'Skip tour'}).click();
  await expect(bubble(page)).toHaveCount(0);
  // Nothing to poll for: proving a write never happens needs a pause long
  // enough that one would have arrived. The positive cases above land well
  // inside this.
  await page.waitForTimeout(1200);
  expect(saved,'closing a chapter is not a refusal of every tour').toEqual([]);
 });
});

/**
 * The two page chapters, which are the ones that rely on anchors inside a
 * lazily loaded route rather than on the chrome. A new member's Journal is
 * empty, so these also prove the controls the steps point at are on screen
 * before there is a single wine to use them on.
 */
test.describe('the page chapters',()=>{
 test.use({viewport:{width:390,height:844}});

 test('walks the Journal with nothing logged yet',async({page})=>{
  const saved=await signedIn(page,'{"completed":["first-run"],"skipped":false}');
  await page.goto('/account');
  await page.getByRole('button',{name:/The Journal/}).click();

  await expect(bubble(page)).toContainText('The Journal \u00b7 Step 1 of 4');
  await expect(page).toHaveURL(/\/journal$/);
  await rings(page,'journal-scopes');

  await page.getByRole('button',{name:'Next'}).click();
  await expect(bubble(page)).toContainText('Smart search');
  await rings(page,'journal-search');

  await page.getByRole('button',{name:'Next'}).click();
  await rings(page,'journal-filters');

  // Select is disabled on an empty Journal but still drawn, so the step holds.
  await page.getByRole('button',{name:'Next'}).click();
  await expect(bubble(page)).toContainText('Several wines at once');
  await rings(page,'journal-select');

  await page.getByRole('button',{name:'Done'}).click();
  await expect.poll(()=>saved).toEqual([{completed:['first-run','chapter-journal'],skipped:false}]);
 });

 test('walks Vintages, which is populated before anything is logged',async({page})=>{
  await signedIn(page,'{"completed":["first-run"],"skipped":false}');
  await page.goto('/account');
  await page.getByRole('button',{name:/^Vintages/}).click();

  await expect(bubble(page)).toContainText('Vintages \u00b7 Step 1 of 3');
  await expect(page).toHaveURL(/\/vintages$/);
  await rings(page,'vintage-village');

  await page.getByRole('button',{name:'Next'}).click();
  await expect(bubble(page)).toContainText('Years at a glance');
  await rings(page,'vintage-strip');

  await page.getByRole('button',{name:'Next'}).click();
  await rings(page,'vintage-key');
 });
});
