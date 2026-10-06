import { test,expect,type Page } from '@playwright/test';
import { wine } from './fixtures/layoutWine';

const producer={
 id:'p1',ownerId:'reader',canonicalName:'Domaine Example',aliases:['Domaine Example'],
 homeCountry:'France',homeRegion:'Burgundy',homeLocality:'Savigny-lès-Beaune',
 officialWebsiteUrl:null,instagramUrl:null,contactEmail:null,contactPhone:null,contactSources:[],
 profile:'A family domaine in Burgundy.',winemakingPractices:'Careful sorting and oak maturation.',heroImageAvailable:false,
 catalog:[],catalogCuvees:[],cuveeCatalogLinks:[],tastedWines:[],linkedProducers:[],supplementaryContacts:[],catalogDecisions:[],
 researchHistoryCount:0,sources:[],researchModel:'test-model',researchedAt:'2026-09-20T00:00:00Z',profileResearchedAt:'2026-09-20T00:00:00Z'
};
const wineChinese={summary:'一款清新、帶礦物感 (mineral) 的白酒。',drinkingWindow:'適合於 2026 至 2032 年飲用。'};
const producerChinese={profile:'Domaine Example 是位於布根地 (Burgundy) 的家族酒莊。',winemakingPractices:'仔細揀選 (sorting) 並以橡木桶陳年 (oak maturation)。'};

async function mock(page:Page,role:'owner'|'member',saved:Record<string,string>|null,made:Record<string,string>){
 const posts:Array<{path:string;body:unknown}>=[];
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(request.method()==='POST'&&path.startsWith('/api/research/translation')){
   const body=request.postDataJSON();posts.push({path,body});
   const asked=(body as {fields:Record<string,string>}).fields;
   if(path.endsWith('/lookup'))return route.fulfill({json:{translation:{lang:'zh-Hant-HK',fields:Object.fromEntries(Object.keys(asked).flatMap(key=>saved?.[key]?[[key,saved[key]]]:[]))}}});
   return route.fulfill({json:{translation:{fields:made}}});
  }
  if(path.endsWith('/research-status')||path.endsWith('/deep-search-status'))return route.fulfill({status:404,json:{error:'No run'}});
  const data=path==='/api/me'?{user:{id:'reader',email:'reader@example.com',display_name:'Reader',role,status:'active'}}
   :path==='/api/producers/p1'?producer
   :path==='/api/wines/layout-wine'?{...wine,deepSearch:{...wine.deepSearch,model:'test-model'}}
   :path==='/api/credits'?{available:20,reserved:0,balance:20}
   :path.endsWith('/research')?{runs:[]}
   :{items:[],holdings:[],runs:[],total:0};
  await route.fulfill({json:data});
 });
 return posts;
}

test('the owner translates Deep Search on request and switches back to English',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const posts=await mock(page,'owner',null,wineChinese);
 await page.goto('/wines/layout-wine');
 const panel=page.locator('.deep-search-panel');
 await expect(panel).toContainText('A fresh, mineral white wine.');
 // Saved Chinese is looked up as soon as the research shows, so the switch never waits on it.
 await expect.poll(()=>posts.map(post=>post.path)).toEqual(['/api/research/translation/lookup']);
 // Small, on the Deep Search heading row, right-aligned, even on a phone.
 const head=await panel.locator('.deep-panel-head').boundingBox(),toggle=await panel.locator('.research-language-switch').boundingBox(),label=await panel.locator('.deep-panel-head .section-label-text').boundingBox();
 expect(toggle!.height).toBeLessThanOrEqual(34);
 expect(Math.abs((toggle!.y+toggle!.height/2)-(label!.y+label!.height/2))).toBeLessThan(8);
 expect(head!.x+head!.width-(toggle!.x+toggle!.width)).toBeLessThan(2);
 await panel.getByRole('button',{name:'繁中'}).click();
 await expect(panel).toContainText('This uses one AI request.');
 expect(posts.map(post=>post.path)).toEqual(['/api/research/translation/lookup']);
 expect(posts[0].body).toEqual({lang:'zh-Hant-HK',fields:{summary:'A fresh, mineral white wine.',drinkingWindow:'Enjoy from 2026 to 2032.'}});
 await panel.getByRole('button',{name:'Translate'}).click();
 await expect(panel).toContainText(wineChinese.summary);
 await expect(panel).toContainText('適飲期');
 await expect(panel.getByRole('button',{name:'繁中'})).toHaveAttribute('aria-pressed','true');
 await panel.screenshot({path:'test-results/research-translation-wine-mobile.png'});
 await panel.getByRole('button',{name:'EN'}).click();
 await expect(panel).toContainText('A fresh, mineral white wine.');
 await panel.getByRole('button',{name:'繁中'}).click();
 await expect(panel).toContainText(wineChinese.summary);
 // Switching back and forth uses the translation already on the page.
 expect(posts.map(post=>post.path)).toEqual(['/api/research/translation/lookup','/api/research/translation']);
});

test('a member sees a saved translation but is never offered a paid one',async({page})=>{
 const posts=await mock(page,'member',null,wineChinese);
 await page.goto('/wines/layout-wine');
 const panel=page.locator('.deep-search-panel');
 await panel.getByRole('button',{name:'繁中'}).click();
 await expect(panel).toContainText('Only the account owner can create one.');
 await expect(panel.getByRole('button',{name:'Translate'})).toHaveCount(0);
 expect(posts.map(post=>post.path)).toEqual(['/api/research/translation/lookup']);
});

test('producer research switches to a saved translation without asking',async({page})=>{
 const posts=await mock(page,'owner',producerChinese,producerChinese);
 await page.goto('/producers/p1');
 await expect(page.getByText('A family domaine in Burgundy.')).toBeVisible();
 await page.getByRole('button',{name:'繁中'}).click();
 await expect(page.getByText(producerChinese.profile)).toBeVisible();
 await expect(page.getByText(producerChinese.winemakingPractices)).toBeVisible();
 await expect(page.getByText('酒莊整體釀酒方式')).toBeVisible();
 expect(posts.map(post=>post.path)).toEqual(['/api/research/translation/lookup']);
 await page.locator('.producer-detail').screenshot({path:'test-results/research-translation-producer.png'});
});

test('research translated by its run switches instantly, labels included',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const posts=await mock(page,'member',wineChinese,wineChinese);
 await page.goto('/wines/layout-wine');
 const panel=page.locator('.deep-search-panel');
 await expect.poll(()=>posts.length).toBe(1);
 await panel.getByRole('button',{name:'繁中'}).click();
 await expect(panel).toContainText(wineChinese.summary);
 await expect(panel).toContainText('1 個研究部分');
 await expect(panel.getByRole('button',{name:'全部展開'})).toBeVisible();
 await expect(panel).not.toContainText('Looking for a saved translation');
 expect(posts.map(post=>post.path)).toEqual(['/api/research/translation/lookup']);
 await panel.getByRole('button',{name:'EN'}).click();
 await expect(panel.getByRole('button',{name:'Expand all'})).toBeVisible();
});

test('a partly translated result shows what exists and offers the owner the rest',async({page})=>{
 const posts=await mock(page,'owner',{summary:wineChinese.summary},wineChinese);
 await page.goto('/wines/layout-wine');
 const panel=page.locator('.deep-search-panel');
 await expect.poll(()=>posts.length).toBe(1);
 await panel.getByRole('button',{name:'繁中'}).click();
 await expect(panel).toContainText(wineChinese.summary);
 await expect(panel).toContainText('1 section is not translated yet.');
 await panel.getByRole('button',{name:'Translate'}).click();
 await expect(panel).not.toContainText('not translated yet');
 expect(posts.map(post=>post.path)).toEqual(['/api/research/translation/lookup','/api/research/translation']);
});
