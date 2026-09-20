import { test,expect,type Page } from '@playwright/test';
import { wine } from './fixtures/layoutWine';

const journey={summary:{totalWines:12,producers:4,countries:2,regions:3,appellations:5,vintages:4,favorites:3,averageRating:null,ratedWines:0,pricedWines:0,structuredTastings:0},countries:[],regions:[],appellations:[],styles:[],producers:[],currencies:[],years:[],structures:[],grapes:[],discovery:{tastings:12,newProducers:4,newRegions:3,newCountries:2},months:[],classifications:[],drinkingAges:[],recentTastings:[]};
const collection={definition:{id:'example',title:'Example collection',subtitle:'A tasting checklist',category:'regional-exploration',icon:'beaujolais-crus',items:[],references:[],editable:true,origin:'custom'},completed:0,possible:0,pending:0,total:0,percent:0,complete:false,items:[],matchMode:'exact',supportsRelaxedMatching:false};
const member={id:'member',display_name:'Jamie',email:'jamie@example.com',role:'member',status:'active',balance:0,reserved:0};
const overview={members:[member],actions:[],settings:{cloudflareObservedMonth:new Date().toISOString().slice(0,7)},prices:[],aiCost:{month:'2026-09',usd:0.12,searches:4},memberUsage:{month:'2026-09',items:[]},actionPolicies:[],actionAccess:[],storage:[],reviewOperations:[]};
async function mock(page:Page,role:'owner'|'member'='owner',usageFailure=false){
 let incoming=[{id:'alex',display_name:'Alex'}];
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(usageFailure&&path==='/api/usage/spend'){await route.fulfill({status:503,json:{error:'Usage temporarily unavailable'}});return}
  if(path.endsWith('/accept'))incoming=[];
  const data=path==='/api/me'?{user:{id:'reader',display_name:'Reader',email:'reader@example.com',role,status:'active'}}
   :path==='/api/friends'?{items:[{id:'jamie',display_name:'Jamie',defaultShare:true}]}
   :path==='/api/friends/requests'?{incoming,outgoing:[]}
   :path==='/api/friends/code'?{code:'ABCD-EFGH-IJKL'}
   :path==='/api/credits'?{balance:0,reserved:0,available:0,sponsoredAi:true,actionAccess:[{action:'recognition',label:'Scan wine',accessMode:'allowance',remaining:3,limit:5,pending:0,granted:0,resetsAt:'2026-09-28T00:00:00Z'}]}
   :path==='/api/usage/spend'?{days:30,empty:false,kinds:[{kind:'search_embedding',label:'Smart Search',runs:8,requests:9,units:7,unit:'wine'}]}
   :path==='/api/admin/overview'?overview
   :path==='/api/admin/rollout/status'?{storage:{state:'not_started',objects:0},research:{state:'not_started',wines:{processed:0,total:0},producers:{processed:0,total:0}},lwin:{state:'not_started',total:0},lwinValidation:{state:'not_started',total:0,reviewItems:[]},lwinAi:{state:'not_started',total:0}}
   :path==='/api/journal'?{items:[{...wine,tastingName:'Dinner not on grid',venue:'Venue not on grid',tastingDate:'2026-09-18',rating:93},{...wine,id:'shared-wine',shared:true,sharedBy:'Alex',wineName:'Blanc de Craie',vintage:null}],total:2,nextOffset:null}
   :path==='/api/journey'?journey
   :path==='/api/achievements'?[collection]
   :path==='/api/achievements/catalogue-options'?{producers:[],cuvees:[],appellations:[],regions:[]}
   :path==='/api/producers/research-batch/history'?{campaigns:[]}
   :path==='/api/tastings/active'?{tasting:null}
   :path==='/api/tastings/evening'?{tasting:{id:'evening',name:'September dinner',tastingDate:'2026-09-18',venue:'Home',startedAt:'2026-09-18T18:00:00Z',endedAt:null},wines:[],documents:[]}
   :path==='/api/wines/layout-wine'?wine
   :{items:[],holdings:[],total:0,runs:[],campaign:null};
  await route.fulfill({json:data});
 });
}
async function fits(page:Page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const clipped=await page.locator('main').evaluate(main=>[...main.querySelectorAll('button,input,select,textarea')].filter(element=>{
  if(!element.getClientRects().length)return false;
  for(let parent=element.parentElement;parent&&parent!==main;parent=parent.parentElement)if(['auto','scroll'].includes(getComputedStyle(parent).overflowX))return false;
  const box=element.getBoundingClientRect();return box.left<0||box.right>innerWidth+1;
 }).map(element=>element.getAttribute('aria-label')||element.textContent?.slice(0,60)));
 expect(clipped).toEqual([]);
}
for(const role of ['owner','member'] as const){
 test(`${role}: account sections retain drafts and isolate failed usage`,async({page},info)=>{
  await mock(page,role,true);await page.goto('/account');
  await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Reader');
  await page.getByLabel('Name',{exact:true}).fill('Unsaved name');
  await page.getByRole('button',{name:'Friends 1'}).click();
  await expect(page).toHaveURL(/section=friends/);
  await expect(page.getByRole('heading',{name:'Friends',exact:true})).toBeVisible();
  await expect(page.getByText('Usage temporarily unavailable')).not.toBeVisible();
  await page.getByRole('button',{name:'Accept Alex'}).click();
  await expect(page.getByText('You and Alex are now friends.')).toBeVisible();
  await page.getByLabel('Friend code',{exact:true}).fill('TEST-CODE');
  await fits(page);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath(`${role}-friends.png`),fullPage:true});
  await page.getByRole('button',{name:'AI usage',exact:true}).click();
  await expect(page.getByText('Usage temporarily unavailable')).toBeVisible();
  await expect(page.getByText('No AI usage recorded yet.')).not.toBeVisible();
  await page.getByRole('button',{name:'Profile',exact:true}).click();
  await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Unsaved name');
  await page.getByRole('button',{name:'Friends',exact:true}).click();
  await expect(page.getByLabel('Friend code',{exact:true})).toHaveValue('TEST-CODE');
  await expect(page.getByRole('link',{name:'Owner tools →'})).toHaveCount(role==='owner'?1:0);
  await page.getByText('Sharing options',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Share all existing wines with Jamie'})).toHaveCount(role==='owner'?1:0);
  await fits(page);
 });
}
test('owner section links, drafts and maintenance',async({page},info)=>{
 await mock(page);await page.goto('/admin#member-usage');
 await expect(page.getByRole('heading',{name:'Member usage · 2026-09'})).toBeVisible();
 await page.getByRole('button',{name:'Access & budgets',exact:true}).click();
 await page.getByLabel('Member limit (owner excluded)',{exact:true}).fill('42');
 await page.getByRole('button',{name:'Members',exact:true}).click();
 await expect(page.getByRole('button',{name:'Create member invitation'})).toBeVisible();
 await page.getByRole('button',{name:'Access & budgets',exact:true}).click();
 await expect(page.getByLabel('Member limit (owner excluded)',{exact:true})).toHaveValue('42');
 await page.getByRole('button',{name:'Maintenance',exact:true}).click();
 await expect(page.getByText('Background maintenance',{exact:true})).toBeVisible();
 await fits(page);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('maintenance.png'),fullPage:true});
});
test('Journal grid stays succinct and filters are removable',async({page},info)=>{
 await mock(page);await page.goto('/journal?country=France');
 await expect(page.locator('.journal-grid-card')).toHaveCount(2);
 const cards=page.locator('.journal-grid-card');
 await expect(cards.first()).not.toContainText('Dinner not on grid');
 await expect(cards.first()).not.toContainText('Venue not on grid');
 await expect(page.locator('.journal-grid-card.shared')).not.toContainText('Alex');
 await expect(page.locator('.journal-grid-card.shared')).toHaveCount(1);
 await expect(page.getByRole('link',{name:/Shared by Alex/i})).toHaveCount(1);
 await page.getByRole('button',{name:'Remove country filter: France'}).click();
 await expect(page).not.toHaveURL(/country=/);
 await fits(page);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('journal.png'),fullPage:true});
 await page.getByRole('button',{name:'Select',exact:true}).click();await fits(page);
 await page.getByRole('button',{name:/^Select Domaine Example/}).click();
 const edit=page.getByRole('button',{name:'Edit event / venue'});await edit.focus();await edit.click();
 await expect(page.getByRole('dialog')).toBeFocused();await page.keyboard.press('Tab');
 await expect(page.getByRole('button',{name:'Close batch editor'})).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(edit).toBeFocused();
});
test('page families fit and render without client errors',async({page},info)=>{
 test.setTimeout(90000);await mock(page);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const paths=['/','/insights','/achievements','/achievements/example','/achievements/new','/achievements/example/edit','/account?section=usage','/journal?scope=cellar','/producers','/tastings','/tastings/evening','/upload','/group-scan','/batch-scan','/wines/new','/producers/research-batch','/admin/lwin-review','/login','/about','/privacy','/terms'];
 for(const [index,path] of paths.entries()){
  await page.goto(path);await expect(page.locator('h1').first()).toBeVisible();await page.waitForLoadState('networkidle');await fits(page);
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath(`family-${index}.png`),fullPage:true});
 }
 expect(errors).toEqual([]);
});

test('owner controls recover from an initial load failure',async({page})=>{
 await mock(page);let fail=true;
 await page.route('**/api/admin/overview',async route=>{if(fail)await route.fulfill({status:503,json:{error:'Owner data unavailable'}});else await route.fallback()});
 await page.goto('/admin');await expect(page.getByRole('alert')).toContainText('Owner data unavailable');
 await expect(page.getByRole('button',{name:'Create member invitation'})).not.toBeVisible();
 fail=false;await page.getByRole('button',{name:'Retry owner controls'}).click();
 await expect(page.getByRole('button',{name:'Create member invitation'})).toBeVisible();
});
