import { test,expect } from '@playwright/test';

test('owner LWIN panel separates live review counts from run history',async({page},info)=>{
 await page.setViewportSize({width:393,height:852});
 const current={total:20,automatic:12,manual:3,identityConflicts:1,fieldUpdates:1,needsReview:2,withoutLwin:4,optedOut:1};
 const status={lwinCurrent:current,storage:{state:'complete',objects:0},research:{state:'complete',wines:{processed:20,total:20},producers:{processed:5,total:5}},lwin:{state:'complete',processed:20,total:20,matched:3,ambiguous:0,unmatched:0,conflict:17},lwinValidation:{state:'complete',processed:20,total:20,verified:3,review:17,reviewItems:[]},lwinAi:{state:'complete',processed:2,total:2,matched:1,deterministic:0,ai:1,review:1}};
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/me')return route.fulfill({json:{user:{id:'owner',role:'owner',email:'owner@example.com',display_name:'Owner',status:'active'}}});
  if(path==='/api/admin/overview')return route.fulfill({json:{members:[],actions:[],settings:null,prices:[],aiCost:{usd:0,searches:0},memberUsage:{month:'2026-09',items:[]},actionPolicies:[],actionAccess:[],storage:[],reviewOperations:[]}});
  if(path==='/api/admin/rollout/status')return route.fulfill({json:status});
  return route.fulfill({json:{items:[],total:0}});
 });
 await page.goto('/admin?section=maintenance');
 const summary=page.getByRole('region',{name:'Current LWIN status'});
 await expect(summary).toContainText('3 manually confirmed links');
 await expect(summary.getByRole('link',{name:'Needs review now: 2'})).toBeVisible();
 await expect(summary).toContainText('Identity conflicts: 1 · Field suggestions only: 1');
 await expect(page.getByText(/17 flagged during this run/)).toBeVisible();
 current.fieldUpdates=0;current.needsReview=1;
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(summary.getByRole('link',{name:'Needs review now: 1'})).toBeVisible();
 await expect(page.getByText(/17 flagged during this run/)).toBeVisible();
 await summary.scrollIntoViewIfNeeded();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('lwin-owner-status.png')});
});
