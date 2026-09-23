import { test,expect } from '@playwright/test';

for(const viewport of [{width:393,height:852},{width:1280,height:900}]){
 test(`producer groups saved and legacy PR releases at ${viewport.width}px`,async({page},info)=>{
  await page.setViewportSize(viewport);
  const wine={vintage:null,appellation:'Champagne',region:'Champagne',country:'France',wineStyle:'sparkling',grapes:[],imageId:null,rating:null,tastingDate:null,catalogCuveeId:null};
  const producer={
   id:'p1',canonicalName:'Henri Giraud',aliases:['Henri Giraud'],homeCountry:'France',homeRegion:'Champagne',homeLocality:'Aÿ',
   officialWebsiteUrl:null,instagramUrl:null,contactEmail:null,contactPhone:null,contactSources:[],
   profile:'',winemakingPractices:'',heroImageAvailable:false,catalog:[],catalogCuvees:[],cuveeCatalogLinks:[],
   linkedProducers:[],supplementaryContacts:[],catalogDecisions:[],researchHistoryCount:0,sources:[],researchedAt:null,
   tastedWines:[
    {...wine,id:'pr21',cuveeId:'pr',wineName:'PR',vintageKind:'multi_vintage',releaseDesignation:'21-90'},
    {...wine,id:'pr20',cuveeId:'legacy-pr',wineName:'PR 20-90',vintageKind:'multi_vintage',releaseDesignation:null},
    {...wine,id:'unknown',cuveeId:'pr',wineName:'PR',vintageKind:'unknown',releaseDesignation:null},
    {...wine,id:'nv',cuveeId:'esprit',wineName:'Esprit Nature',vintageKind:'non_vintage',releaseDesignation:null}
   ]
  };
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/me')return route.fulfill({json:{user:{id:'member',role:'member',email:'member@example.com',display_name:'Member',status:'active'}}});
   if(path==='/api/producers/p1')return route.fulfill({json:producer});
   return route.fulfill({json:{items:[],total:0}});
  });
  await page.goto('/producers/p1');
  await expect(page.getByRole('heading',{name:'2 cuvées · 4 tastings'})).toBeVisible();
  await expect(page.locator('.producer-header-stats')).toHaveText('2 tasted');
  const pr=page.locator('.tasted-cuvee-group').filter({has:page.locator('.tasted-cuvee-title strong',{hasText:/^PR$/})});
  await expect(pr).toHaveCount(1);
  await expect(pr.locator('.tasted-cuvee-title small')).toContainText('2 releases');
  await expect(pr.locator('.tasted-copy strong')).toHaveText(['21-90','20-90','Year unknown']);
  await expect(pr.locator('.tasted-copy span').first()).toContainText('MV');
  await expect(pr.locator('.tasted-copy span').nth(1)).toContainText('MV');
  await expect(pr.locator('.tasted-row-link').first()).toHaveAttribute('href','/wines/pr21');
  await expect(page.locator('.tasted-cuvee-group').filter({hasText:'Esprit Nature'}).locator('.tasted-copy strong')).toHaveText('NV');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await pr.scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath(`producer-releases-${viewport.width}.png`),fullPage:true});
 });
}
