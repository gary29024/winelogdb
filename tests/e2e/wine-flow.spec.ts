import { test,expect,type Page } from '@playwright/test';
const user={id:'alice',email:'alice@example.com',display_name:'Alice',role:'member',status:'active'};
async function signedIn(page:Page){await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;const data=path==='/api/me'?{user}:path==='/api/credits'?{available:20,reserved:0,balance:20}:path==='/api/friends/code'?{code:'A1B2-C3D4-E5F6'}:path==='/api/friends/requests'?{incoming:[],outgoing:[]}:path==='/api/friends'?{items:[{id:'bob',display_name:'Bob'}]}:path==='/api/shared/wines'?{items:[{id:'w',ownerName:'Bob',producer:'Domaine Dujac',wineName:'Clos de la Roche',vintage:2020,tastingNotes:'Bright cherry',rating:4,tastingDate:'2026-09-01'}],nextOffset:null}:{items:[],total:0,nextOffset:null};await route.fulfill({json:data})})}
test('Google invitation login has no legacy password form',async({page})=>{
 await page.route('**/api/me',route=>route.fulfill({status:401,json:{error:'Sign in required'}}));await page.goto('/login?invitation=single-use');
 await expect(page.getByRole('link',{name:/Google/})).toHaveAttribute('href','/api/auth/google/start?invitation=single-use');await expect(page.locator('input[type=password]')).toHaveCount(0);
});
test('friend codes send pending requests and only acceptance adds a friend',async({page})=>{
 await page.setViewportSize({width:390,height:844});await signedIn(page);
 let sent=false,accepted=false,declined=false;
 await page.route('**/api/friends',route=>route.fulfill({json:{items:accepted?[{id:'carol',display_name:'Carol'}]:[]}}));
 await page.route('**/api/friends/requests',async route=>{
  if(route.request().method()==='POST'){expect(route.request().postDataJSON()).toEqual({code:'1234-5678-ABCD'});sent=true;await route.fulfill({status:201,json:{id:'outgoing',status:'pending'}});return}
  await route.fulfill({json:{incoming:[...accepted?[]:[{id:'incoming',display_name:'Carol'}],...declined?[]:[{id:'decline',display_name:'Dave'}]],outgoing:sent?[{id:'outgoing',display_name:'Bob'}]:[]}});
 });
 await page.route('**/api/friends/requests/incoming/accept',async route=>{expect(route.request().method()).toBe('POST');accepted=true;await route.fulfill({json:{ok:true}})});
 await page.route('**/api/friends/requests/decline',async route=>{expect(route.request().method()).toBe('DELETE');declined=true;await route.fulfill({json:{ok:true}})});
 await page.route('**/api/friends/requests/outgoing',async route=>{expect(route.request().method()).toBe('DELETE');sent=false;await route.fulfill({json:{ok:true}})});
 await page.goto('/account');await expect(page.getByRole('textbox',{name:'Your friend code',exact:true})).toHaveValue('A1B2-C3D4-E5F6');
 await expect(page.getByRole('button',{name:'Create friend link'})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Friend code',exact:true}).fill('1234-5678-ABCD');await page.getByRole('button',{name:'Send friend request'}).click();
 await expect(page.getByText('Bob · Awaiting acceptance')).toBeVisible();await expect(page.getByRole('button',{name:'Remove friend'})).toHaveCount(0);
 await page.getByRole('button',{name:'Accept Carol',exact:true}).click();await expect(page.getByText('You and Carol are now friends.')).toBeVisible();await expect(page.getByRole('button',{name:'Remove friend'})).toHaveCount(1);
 await page.getByRole('button',{name:'Decline Dave',exact:true}).click();await expect(page.getByText('No incoming requests.')).toBeVisible();
 await page.getByRole('button',{name:'Cancel request to Bob',exact:true}).click();await expect(page.getByText('No pending sent requests.')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('account and shared wines remain separate from the journal on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await signedIn(page);await page.goto('/account');await expect(page.getByText('20 credits available')).toBeVisible();await expect(page.getByRole('heading',{name:'Friends',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Shared with me'}).click();await expect(page.getByRole('heading',{name:'Shared with me',exact:true})).toBeVisible();await expect(page.getByText('Bright cherry')).toBeVisible();await expect(page.getByRole('button',{name:/Edit|Add to journal/})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('a scan requires the server quote and cancellation invokes no AI',async({page})=>{
 await signedIn(page);let submissions=0;
 await page.route('**/api/credits/quotes?*',route=>route.fulfill({json:{id:'quote-1',total:5,available:20,units:[{action:'scan_single',credits:5}]}}));
 await page.route('**/api/recognition',async route=>{submissions++;expect(route.request().headers()['x-winelog-quote']).toBe('quote-1');expect(route.request().headers()['idempotency-key']).toBeTruthy();await route.fulfill({json:{producer:'Domaine Dujac',wineName:'Clos de la Roche',vintage:2020,country:'France',region:'Burgundy',appellation:'Clos de la Roche',style:'red',confidence:.95}})});
 await page.goto('/upload');const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=600;canvas.height=800;const c=canvas.getContext('2d')!;c.fillStyle='white';c.fillRect(0,0,600,800);c.fillStyle='black';c.fillText('Wine label',40,100);return canvas.toDataURL('image/png').split(',')[1]});
 await page.locator('input[type=file]').setInputFiles({name:'wine.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.getByRole('button',{name:'Identify this wine',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(submissions).toBe(0);
 await page.getByRole('button',{name:'Identify this wine',exact:true}).click();await page.getByRole('button',{name:'Use 5 credits',exact:true}).click();await expect(page.getByRole('heading',{name:'Combined identification'})).toBeVisible();expect(submissions).toBe(1);
});
