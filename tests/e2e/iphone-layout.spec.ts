import { test,expect,devices,type Page,type TestInfo } from '@playwright/test';
import { wine } from './fixtures/layoutWine';

const producer={
 id:'p1',ownerId:'reader',canonicalName:'Domaine Example',aliases:['Domaine Example'],
 homeCountry:'France',homeRegion:'Burgundy',homeLocality:'Savigny-lès-Beaune',
 officialWebsiteUrl:null,instagramUrl:null,contactEmail:null,contactPhone:null,contactSources:[],
 profile:'A family domaine in Burgundy.',winemakingPractices:'Careful sorting and oak maturation.',heroImageAvailable:false,
 catalog:[
  {name:'Clos de la Roche',category:'red',appellation:'Clos de la Roche',classification:'Grand Cru',style:null,notes:null},
  {name:'Les Vergelesses',category:'white',appellation:'Savigny-lès-Beaune',classification:'Premier Cru',style:null,notes:null},
 ],
 catalogCuvees:[],cuveeCatalogLinks:[],tastedWines:[],linkedProducers:[],supplementaryContacts:[],catalogDecisions:[],
 researchHistoryCount:0,sources:[],researchModel:'layout-test-model',researchedAt:'2026-09-20T00:00:00Z',profileResearchedAt:'2026-09-20T00:00:00Z'
};

async function mockAccount(page:Page,role:'owner'|'member'){
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const data=path==='/api/me'?{user:{id:'reader',email:'reader@example.com',display_name:'Reader',role,status:'active'}}
   :path==='/api/producers/p1'?producer
   :path==='/api/wines/layout-wine'?{...wine,tastingStructure:{acidity:'high'},
    deepSearch:{...wine.deepSearch,vintageQuality:'A balanced growing season.',producerDetails:'A family domaine in Burgundy.',producerWinemakingPractices:'Careful sorting and gentle pressing.',winemakingTechniques:'Fermented and matured in oak.',terroir:'Limestone soils above the village.',model:'layout-test-model',quality:{status:'mixed',score:82,sourceTier:'primary',warnings:[]}}}
   :path==='/api/shared/wines/layout-wine'?{...wine,structure:null}
   :path==='/api/journal'?{items:[wine],total:1,nextOffset:null}
   :path==='/api/credits'?{available:20,reserved:0,balance:20}
   :path.endsWith('/research')?{runs:[]}
   :{items:[],holdings:[],total:0};
  if(path.endsWith('/research-status')){await route.fulfill({status:404,json:{error:'No run'}});return}
  await route.fulfill({json:data});
 });
}

async function fits(page:Page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const clipped=await page.locator('main').evaluate(main=>{
  return [...main.querySelectorAll('button,a,input,select,textarea,.section-label')].filter(element=>{
   if(!element.getClientRects().length)return false;
   // Horizontally scrollable filter strips intentionally extend within their own viewport.
   for(let parent=element.parentElement;parent&&parent!==main;parent=parent.parentElement){
    if(['auto','scroll'].includes(getComputedStyle(parent).overflowX))return false;
   }
   const bounds=element.getBoundingClientRect();
   return bounds.left<0||bounds.right>innerWidth+1;
  }).map(element=>element.textContent?.trim().slice(0,80));
 });
 expect(clipped).toEqual([]);
}

async function screenshot(page:Page,info:TestInfo,name:string){
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:info.outputPath(`${name}.png`),fullPage:true,scale:'css',animations:'disabled'});
}

for(const role of ['owner','member'] as const){
 test.describe(role,()=>{
  test.beforeEach(async({page})=>{await mockAccount(page,role)});

  test('wine detail, research and shared experience fit the phone',async({page},info)=>{
   await page.goto('/wines/layout-wine');
   await expect(page.getByRole('heading',{name:wine.wineName,exact:true})).toBeVisible();
   await expect(page.locator('.tasting-structure-summary')).toBeVisible();
   const structureLabel=page.locator('.tasting-structure-summary dt').first();
   await expect(structureLabel).toHaveText('Acidity');
   expect(await structureLabel.evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(0);
   expect(await structureLabel.evaluate(element=>getComputedStyle(element,'::after').content)).not.toContain('Intensity');
   await expect(page.getByRole('link',{name:'Edit tasting',exact:true})).toBeVisible();
   await expect(page.getByText('Latest research model:',{exact:false})).toHaveCount(role==='owner'?1:0);
   const smallActions=await page.locator('.wine-actions>a,.wine-actions>button').evaluateAll(actions=>actions.filter(action=>action.getBoundingClientRect().height<44).length);
   expect(smallActions).toBe(0);
   const heading=page.locator('.deep-panel-head .section-label-text');
   expect(await heading.evaluate(element=>element.getBoundingClientRect().height<=parseFloat(getComputedStyle(element).fontSize)*1.6)).toBe(true);
   await fits(page);
   await screenshot(page,info,'personal-wine');
   const device=devices[info.project.name];
   if(device){
    // Simulate standalone mode using the shell's existing safe-area variables.
    await page.setViewportSize({width:device.viewport.width,height:info.project.name==='iPhone 15 Pro'?852:932});
    await page.evaluate(()=>{
     document.documentElement.style.setProperty('--app-safe-top','59px');
     document.documentElement.style.setProperty('--app-safe-bottom','34px');
    });
    await fits(page);
    const header=await page.locator('.topbar').boundingBox();
    expect(header!.height).toBeGreaterThanOrEqual(59+44);
    await page.getByRole('button',{name:'Delete this wine',exact:true}).scrollIntoViewIfNeeded();
    const lastAction=await page.getByRole('button',{name:'Delete this wine',exact:true}).boundingBox();
    const navigation=await page.getByRole('navigation',{name:'Mobile navigation'}).boundingBox();
    expect(lastAction!.y+lastAction!.height).toBeLessThanOrEqual(navigation!.y);
    await screenshot(page,info,'standalone-wine');
    await page.evaluate(()=>{
     document.documentElement.style.removeProperty('--app-safe-top');
     document.documentElement.style.removeProperty('--app-safe-bottom');
    });
    await page.setViewportSize(device.viewport);
   }
   // This fixture has only a summary/window; incomplete research offers to
   // fill the missing scopes rather than refresh an already complete report.
   await page.getByRole('button',{name:'Deep Search',exact:true}).click();
   await expect(page.getByRole('button',{name:'Queue Deep Search',exact:true})).toBeVisible();
   await fits(page);
   await page.goto('/shared/layout-wine');
   await expect(page.getByRole('heading',{name:wine.wineName,exact:true})).toBeVisible();
   await expect(page.getByRole('link',{name:'Edit tasting',exact:true})).toHaveCount(0);
   await expect(page.getByText('Latest research model:',{exact:false})).toHaveCount(0);
   await expect(page.getByText('Structure',{exact:true})).toHaveCount(0);
   await page.getByRole('button',{name:'Add your experience',exact:true}).click();
   await expect(page.getByRole('button',{name:'Save experience',exact:true})).toBeVisible();
   await fits(page);
   const smallInputs=await page.locator('.shared-experience-form input,.shared-experience-form textarea,.shared-experience-form select').evaluateAll(inputs=>inputs.filter(input=>parseFloat(getComputedStyle(input).fontSize)<16).length);
   expect(smallInputs).toBe(0);
   await screenshot(page,info,'shared-experience');
  });

  test('producer keeps the appropriate controls for the account role',async({page},info)=>{
   await page.goto('/producers/p1');
   await expect(page.getByRole('heading',{name:'Domaine Example',exact:true})).toBeVisible();
   await expect(page.locator('.producer-range')).toHaveCount(role==='owner'?1:0);
   await expect(page.getByRole('button',{name:'Refresh wine range',exact:true})).toHaveCount(role==='owner'?1:0);
   await expect(page.getByRole('heading',{name:role==='owner'?'Profile & range':'Producer profile',exact:true})).toBeVisible();
   if(role==='owner'){
    await page.getByRole('button',{name:'Village',exact:true}).click();
    await expect(page.locator('.composition')).toBeVisible();
   }else{
    await expect(page.getByRole('button',{name:'Refresh profile',exact:true})).toBeVisible();
    await expect(page.locator('.composition,.range-axis-tabs')).toHaveCount(0);
   }
   await fits(page);
   await screenshot(page,info,'producer');
  });

  test('Journal filters and scan sheet fit the phone',async({page},info)=>{
   await page.goto('/journal');
   await expect(page.locator('.journal-card')).toHaveCount(1);
   await page.getByRole('button',{name:'Filters',exact:true}).click();
   await expect(page.getByLabel('Drinking month')).toBeVisible();
   expect(await page.locator('.filter-pills').evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
   const smallInputs=await page.locator('.filter-pills input,.filter-pills select').evaluateAll(inputs=>inputs.filter(input=>parseFloat(getComputedStyle(input).fontSize)<16).length);
   expect(smallInputs).toBe(0);
   await fits(page);
   await screenshot(page,info,'journal');
   await page.getByRole('button',{name:'Scan Wine',exact:true}).click();
   await expect(page.getByRole('dialog',{name:'Add wine'})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await screenshot(page,info,'scan-sheet');
  });

  test('rotation keeps navigation and wine details within the phone',async({page},info)=>{
   const device=devices[`${info.project.name} landscape`];
   test.skip(!device,'Only run the rotation check with an iPhone project');
   await page.setViewportSize(device.viewport);
   await page.goto('/wines/layout-wine');
   await expect(page.getByRole('heading',{name:wine.wineName,exact:true})).toBeVisible();
   await expect(page.getByRole('navigation',{name:'Mobile navigation'})).toBeVisible();
   await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeHidden();
   const oversizedIcons=await page.locator('.mobile-nav .app-icon').evaluateAll(icons=>icons.filter(icon=>icon.getBoundingClientRect().height>30).length);
   expect(oversizedIcons).toBe(0);
   await page.evaluate(()=>{
    document.documentElement.style.setProperty('--app-safe-left','59px');
    document.documentElement.style.setProperty('--app-safe-right','59px');
    document.documentElement.style.setProperty('--app-safe-bottom','21px');
   });
   await fits(page);
   const main=await page.locator('main').evaluate(element=>({left:parseFloat(getComputedStyle(element).paddingLeft),right:parseFloat(getComputedStyle(element).paddingRight)}));
   expect(main.left).toBeGreaterThanOrEqual(59);expect(main.right).toBeGreaterThanOrEqual(59);
   await screenshot(page,info,'landscape-wine');
  });
 });
}
