import { test,expect,type Page } from '@playwright/test';
import { wine } from './fixtures/layoutWine';
import { getAchievementDefinition } from '../../src/features/achievements/curatedLaunch';

const chambertinUrl='https://burgundyatlas.com/place/ba_designation_ynrwzabbmfahxtxy3ervwn4vca/chambertin';
const definition=getAchievementDefinition('burgundy-33-grand-crus')!;
const collection={definition,completed:1,possible:0,pending:32,total:33,percent:3,complete:false,matchMode:'exact',supportsRelaxedMatching:false,
  items:definition.items.map(item=>({...item,status:item.label==='Chambertin'?'tasted':'pending',
    tastedWineIds:item.label==='Chambertin'?['layout-wine']:[],tastedVintages:item.label==='Chambertin'?[2020]:[],
    tastedVintageLinks:item.label==='Chambertin'?[{vintage:2020,wineId:'layout-wine'}]:[]}))};

async function mockApi(page:Page,overrides:Record<string,unknown>={}){
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const data=path==='/api/me'?{user:{id:'reader',email:'reader@example.com',display_name:'Reader',role:'member',status:'active'}}
      :path==='/api/achievements'?[collection]
      :path==='/api/wines/layout-wine'||path==='/api/shared/wines/layout-wine'?{...wine,
        wineName:'Chambertin Grand Cru',appellation:'Chambertin',classification:'grand_cru',
        wineStyle:'red',colour:'Red',grapes:['Pinot Noir'],grapeBlend:[],deepSearch:null,
        lwin7:null,lwin11:null,elid:null,referenceSite:null,identityMatchStatus:null,...overrides}
      :path.endsWith('/research')?{runs:[]}:{items:[],holdings:[],total:0};
    await route.fulfill({json:data});
  });
}

for(const route of ['/wines/layout-wine','/shared/layout-wine']){
  test(`${route}: Atlas link preserves the journal and fits phone and desktop layouts`,async({page},testInfo)=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    const atlasRequests:string[]=[];
    page.on('request',request=>{if(new URL(request.url()).hostname==='burgundyatlas.com')atlasRequests.push(request.url())});
    await mockApi(page);await page.goto(route);
    const link=page.getByRole('link',{name:'Explore on Burgundy Atlas: Chambertin (opens in a new tab)',exact:true});
    await expect(link).toHaveAttribute('href',chambertinUrl);
    await expect(link).toHaveAttribute('target','_blank');
    await expect(link).toHaveAttribute('rel','noopener noreferrer');
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:900});
      await expect(link).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:testInfo.outputPath(`atlas-detail-${width}.png`)});
    }
    expect(atlasRequests).toEqual([]);
    await page.context().route('https://burgundyatlas.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Atlas destination</h1>'}));
    const [popup]=await Promise.all([page.waitForEvent('popup'),link.click()]);
    await expect(popup).toHaveURL(chambertinUrl);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    expect(errors).toEqual([]);
  });
}

test('Grand Cru checklist links both tasted and pending rows without replacing tasting links',async({page},testInfo)=>{
  await mockApi(page);await page.goto('/achievements/burgundy-33-grand-crus');
  await expect(page.locator('.burgundy-atlas-link')).toHaveCount(33);
  const tasted=page.locator('.achievement-check-row').filter({has:page.getByText('Chambertin',{exact:true})});
  await expect(tasted.getByRole('link',{name:'2020',exact:true})).toHaveAttribute('href','/wines/layout-wine');
  await expect(tasted.locator('.burgundy-atlas-link')).toHaveAttribute('href',chambertinUrl);
  const pending=page.locator('.achievement-check-row').filter({has:page.getByText('La Romanée',{exact:true})});
  await expect(pending.getByText('Not tasted',{exact:true})).toBeVisible();
  await expect(pending.locator('.burgundy-atlas-link')).toHaveAttribute('href',/ba_designation_z4rwjlfbbel4n3rsdrx5iazjca/);
  for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`atlas-collection-${width}.png`)});
  }
});

test('unsupported Premier Cru names do not acquire a Grand Cru link',async({page})=>{
  await mockApi(page,{appellation:'Gevrey-Chambertin',classification:'premier_cru',wineName:'Gevrey-Chambertin Les Cazetiers'});
  await page.goto('/wines/layout-wine');
  await expect(page.getByRole('heading',{name:'Gevrey-Chambertin Les Cazetiers',exact:true})).toBeVisible();
  await expect(page.locator('.burgundy-atlas-link')).toHaveCount(0);
});
