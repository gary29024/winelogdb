import { test,expect,type Page } from '@playwright/test';
import { wine } from './fixtures/layoutWine';
import { getAchievementDefinition } from '../../src/features/achievements/curatedLaunch';

const chambertinUrl='https://burgundyatlas.com/place/ba_designation_ynrwzabbmfahxtxy3ervwn4vca/chambertin';
const definition=getAchievementDefinition('burgundy-33-grand-crus')!;
const collection={definition,completed:1,possible:0,pending:32,total:33,percent:3,complete:false,matchMode:'exact',supportsRelaxedMatching:false,
  items:definition.items.map(item=>({...item,status:item.label==='Chambertin'?'tasted':'pending',
    tastedWineIds:item.label==='Chambertin'?['layout-wine']:[],tastedVintages:item.label==='Chambertin'?[2020]:[],
    tastedVintageLinks:item.label==='Chambertin'?[{vintage:2020,wineId:'layout-wine'}]:[]}))};

// A producer's range, where one row is a cuvée name rather than an appellation
// and so has no Atlas destination at all.
const drcDefinition=getAchievementDefinition('domaine-romanee-conti')!;
const drcCollection={definition:drcDefinition,completed:0,possible:0,pending:drcDefinition.items.length,
  total:drcDefinition.items.length,percent:0,complete:false,matchMode:'exact',supportsRelaxedMatching:false,
  items:drcDefinition.items.map(item=>({...item,status:'pending',tastedWineIds:[],tastedVintages:[],tastedVintageLinks:[]}))};

async function mockApi(page:Page,overrides:Record<string,unknown>={}){
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const data=path==='/api/me'?{user:{id:'reader',email:'reader@example.com',display_name:'Reader',role:'member',status:'active'}}
      :path==='/api/achievements'?[collection,drcCollection]
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

test('the Domaine checklist links its appellations and leaves the cuvée row alone',async({page})=>{
  await mockApi(page);await page.goto('/achievements/domaine-romanee-conti');
  await expect(page.getByRole('heading',{name:'Domaine de la Romanée-Conti',exact:true})).toBeVisible();
  // Nine of ten: the tenth row is the one the matcher is right to refuse.
  await expect(page.locator('.burgundy-atlas-link')).toHaveCount(9);
  const cuvee=page.locator('.achievement-check-row').filter({has:page.getByText('Cuvée Duvault-Blochet',{exact:true})});
  await expect(cuvee).toHaveCount(1);
  await expect(cuvee.locator('.burgundy-atlas-link')).toHaveCount(0);
  // The estate's own row points at the appellation every grower shares, not at
  // a page about the Domaine.
  const conti=page.locator('.achievement-check-row').filter({has:page.getByText('Romanée-Conti',{exact:true})});
  await expect(conti.locator('.burgundy-atlas-link')).toHaveAttribute('href',/ba_designation_ps4pmljcohuy5bihimkoykpaou/);
  for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});

for(const route of ['/wines/layout-wine','/shared/layout-wine']){
  test(`${route}: a named Premier Cru links to its village-specific Atlas destination`,async({page},testInfo)=>{
    const atlasRequests:string[]=[];
    page.on('request',request=>{if(new URL(request.url()).hostname==='burgundyatlas.com')atlasRequests.push(request.url())});
    await mockApi(page,{appellation:'Gevrey-Chambertin',classification:'premier_cru',wineName:'Gevrey-Chambertin Les Cazetiers'});
    await page.goto(route);
    const link=page.getByRole('link',{name:'Explore on Burgundy Atlas: Gevrey-Chambertin — Les Cazetiers (opens in a new tab)',exact:true});
    const destination='https://burgundyatlas.com/place/ba_designation_4wgzv3yeruhebw2d535r27kjfm/les-cazetiers';
    await expect(link).toHaveAttribute('href',destination);
    await expect(link).toHaveAttribute('target','_blank');
    await expect(link).toHaveAttribute('rel','noopener noreferrer');
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:900});await expect(link).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:testInfo.outputPath(`atlas-premier-detail-${width}.png`)});
    }
    expect(atlasRequests).toEqual([]);
    await page.context().route('https://burgundyatlas.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Atlas destination</h1>'}));
    const [popup]=await Promise.all([page.waitForEvent('popup'),link.click()]);
    await expect(popup).toHaveURL(destination);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
  });
}

test('a recorded vineyard supplies the cru, with an appellation fallback when no plot is mapped',async({page})=>{
  const examples=[
    {wineName:'Meursault Premier Cru',referenceSite:'Les Perrières',identityMatchStatus:'matched',destination:'plot'},
    {wineName:'Meursault Premier Cru',referenceSite:'Les Perrières',identityMatchStatus:'conflict',destination:null},
    {wineName:'Meursault Premier Cru',referenceSite:null,destination:'appellation'},
    {wineName:'Puligny-Montrachet Les Perrières',referenceSite:null,destination:null},
    {wineName:'Meursault Unknown Vineyard',referenceSite:null,destination:'appellation'},
  ];
  for(const {destination,...fields} of examples){
    await mockApi(page,{appellation:'Meursault',classification:'premier_cru',wineStyle:'white',colour:'White',grapes:['Chardonnay'],...fields});
    await page.goto('/shared/layout-wine');
    await expect(page.getByRole('heading',{name:fields.wineName,exact:true})).toBeVisible();
    const link=page.locator('.burgundy-atlas-link');
    await expect(link).toHaveCount(destination?1:0);
    if(destination)await expect(link).toHaveAttribute('href',destination==='plot'
      ?'https://burgundyatlas.com/place/ba_designation_3ftvudbzi36k7gndmas6x36rje/perrieres'
      :'https://burgundyatlas.com/place/ba_appellation_d2dm6decs2nnkxhviyfpoa4bla/meursault-premier-cru');
  }
});

for(const route of ['/wines/layout-wine','/shared/layout-wine']){
  test(`${route}: village and mixed-plot wines use a clearly labelled appellation link`,async({page},testInfo)=>{
    const requests:string[]=[];
    page.on('request',request=>{if(new URL(request.url()).hostname==='burgundyatlas.com')requests.push(request.url())});
    const examples=[
      {classification:'village',wineName:'Meursault Les Narvaux',name:'Meursault',path:'ba_appellation_i5feobqdq556kq7i5jynpzeelu/meursault'},
      {classification:'premier_cru',wineName:'Meursault Premier Cru',name:'Meursault Premier Cru',path:'ba_appellation_d2dm6decs2nnkxhviyfpoa4bla/meursault-premier-cru'},
      {classification:'premier_cru',wineName:'Meursault Les Perrières / Charmes',name:'Meursault Premier Cru',path:'ba_appellation_d2dm6decs2nnkxhviyfpoa4bla/meursault-premier-cru'},
    ];
    for(const {name,path,...fields} of examples){
      await mockApi(page,{appellation:'Meursault',wineStyle:'white',colour:'White',grapes:['Chardonnay'],...fields});await page.goto(route);
      const link=page.getByRole('link',{name:`Explore appellation on Burgundy Atlas: ${name} (opens in a new tab)`,exact:true});
      await expect(link).toHaveText('Explore appellation on Burgundy Atlas↗');
      await expect(link).toHaveAttribute('href',`https://burgundyatlas.com/place/${path}`);
      await expect(link).toHaveAttribute('target','_blank');
      await expect(link).toHaveAttribute('rel','noopener noreferrer');
      for(const width of [320,390,1280]){
        await page.setViewportSize({width,height:900});await expect(link).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        await page.screenshot({path:testInfo.outputPath(`atlas-appellation-${fields.classification}-${width}.png`)});
      }
    }
    expect(requests).toEqual([]);
    await page.context().route('https://burgundyatlas.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Appellation destination</h1>'}));
    const [popup]=await Promise.all([page.waitForEvent('popup'),page.getByRole('link',{name:/Explore appellation on Burgundy Atlas/}).click()]);
    await expect(popup).toHaveURL(`https://burgundyatlas.com/place/${examples[2].path}`);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
  });
}
