import {test,expect} from '@playwright/test';
import {wine} from './fixtures/layoutWine';

for(const state of ['running','failed','held','uncertain','friend'] as const){
 test(`restores ${state} Deep Search after reopening`,async({page})=>{
  let posts=0;
  await page.route('**/api/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname;
   if(request.method()==='POST')posts++;
   const data=path==='/api/me'?{user:{id:'reader',email:'reader@example.com',display_name:'Reader',role:'member',status:'active'}}
    :path==='/api/wines/layout-wine'?{...wine,deepSearch:null}
    :path.endsWith('/deep-search-status')?{requestId:'recovery-support-id',wineId:'layout-wine',status:['running','friend'].includes(state)?'running':'failed',stage:state==='friend'?'queued':state==='running'?'researching':'failed',retryBlocked:state==='held',outcome:state==='uncertain'?'uncertain':undefined,waitingForFriend:state==='friend',creditOperationId:'follower-operation',message:'Provider/model diagnostic hidden from members',startedAt:new Date().toISOString()}
    :path.includes('/credits/operations/')?{status:'running'}
    :{items:[],holdings:[],runs:[],total:0};
   await route.fulfill({json:data});
  });
  for(const reopen of [false,true]){
   if(reopen)await page.reload();else await page.goto('/wines/layout-wine');
   const panel=page.locator('.deep-search-panel');
   if(state==='friend')await expect(panel).toContainText('A friend is researching this wine.');
   else{
    await expect(panel).toContainText('Support ID recovery-support-id');
    await expect(panel).toContainText(state==='held'?'Deep Search needs review.':state==='running'?'Researching in the background':state==='uncertain'?'WineLog could not confirm the research outcome.':'Deep Search did not complete.');
   }
   await expect(panel).not.toContainText('Provider/model diagnostic');
   if(state==='held')await expect(panel.getByRole('button',{name:'Retry Deep Search'})).toHaveCount(0);
  }
  expect(posts).toBe(0);
 });
}

test('checks a held request and stops waiting without starting another Deep Search',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const posts:string[]=[];let held=true;
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(request.method()==='POST')posts.push(path);
  if(path.endsWith('/deep-search-cancel')){
   expect(request.postDataJSON()).toEqual({confirmation:'STOP_WAITING_DEEP_SEARCH',requestId:'held-support-id'});
   held=false;await route.fulfill({json:{ok:true,cancelled:true,alreadyTerminal:false}});return;
  }
  const data=path==='/api/me'?{user:{id:'reader',email:'reader@example.com',display_name:'Reader',role:'member',status:'active'}}
   :path==='/api/wines/layout-wine'?{...wine,deepSearch:null}
   :path.endsWith('/deep-search-status')?{requestId:'held-support-id',wineId:'layout-wine',status:'failed',stage:'failed',retryBlocked:held,outcome:'uncertain',recoveryDeadline:held?'2026-09-27T04:00:00.000Z':undefined,startedAt:new Date().toISOString()}
   :{items:[],holdings:[],runs:[],total:0};
  await route.fulfill({json:data});
 });
 await page.goto('/wines/layout-wine');
 const panel=page.locator('.deep-search-panel');
 await panel.getByRole('button',{name:'Check status'}).click();
 await expect(panel).toContainText('Still waiting for a saved result.');
 await expect(panel.getByRole('button',{name:'Stop waiting'})).toBeEnabled();
 expect(posts).toEqual(['/api/wines/layout-wine/deep-search-status']);
 await panel.screenshot({path:'test-results/deep-search-held-mobile.png'});
 page.once('dialog',dialog=>dialog.accept());
 await panel.getByRole('button',{name:'Stop waiting'}).click();
 await expect(panel).toContainText('Stopped waiting.');
 await expect(panel.getByRole('button',{name:'Retry Deep Search'})).toBeVisible();
 expect(posts).toEqual(['/api/wines/layout-wine/deep-search-status','/api/wines/layout-wine/deep-search-cancel']);
 await page.reload();
 await expect(panel.getByRole('button',{name:'Retry Deep Search'})).toBeVisible();
 await expect(panel.getByRole('button',{name:'Stop waiting'})).toHaveCount(0);
});
