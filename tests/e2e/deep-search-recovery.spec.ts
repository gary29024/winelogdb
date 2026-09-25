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
