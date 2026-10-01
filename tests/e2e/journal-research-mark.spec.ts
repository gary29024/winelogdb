import { test,expect } from '@playwright/test';
import { wine } from './fixtures/layoutWine';

test('Journal marks complete Deep Search quietly and filters researched and not researched wines',async({page},info)=>{
 await page.setViewportSize({width:393,height:852});
 const items=[
  {...wine,id:'done',wineName:'Clos de la Roche',vintage:2019,researchComplete:true},
  {...wine,id:'partial',wineName:'Morey-Saint-Denis',vintage:2020,researchComplete:false},
  {...wine,id:'none',wineName:'Bourgogne Rouge',vintage:2021}
 ];
 const research:string[]=[];
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/me')return route.fulfill({json:{user:{id:'reader',role:'member',display_name:'Reader',status:'active'}}});
  if(url.pathname==='/api/journal'){
   const filter=url.searchParams.get('research')??'';research.push(filter);
   const shown=filter==='complete'?items.filter(item=>item.researchComplete):filter==='incomplete'?items.filter(item=>!item.researchComplete):items;
   return route.fulfill({json:{items:shown,total:shown.length,nextOffset:null}});
  }
  return route.fulfill({json:{items:[]}});
 });
 await page.goto('/journal');
 await page.getByRole('button',{name:'List',exact:true}).click();
 await expect(page.locator('.journal-card-shell')).toHaveCount(3);
 await expect(page.getByRole('img',{name:'Deep Search complete'})).toHaveCount(1);
 await page.screenshot({path:info.outputPath('journal-research-list-393.png')});
 await page.getByRole('button',{name:'Grid',exact:true}).click();
 await expect(page.getByRole('img',{name:'Deep Search complete'})).toHaveCount(1);
 await page.screenshot({path:info.outputPath('journal-research-grid-393.png')});
 await page.locator('.journal-filter-toggle, button:has-text("Filters")').first().click();
 await page.getByRole('combobox',{name:'Deep Search',exact:true}).selectOption('incomplete');
 await expect(page.locator('.journal-card-shell')).toHaveCount(2);
 await expect.poll(()=>research.at(-1)).toBe('incomplete');
 await expect(page.getByRole('button',{name:/Remove research filter/})).toContainText('Not researched');
 await page.screenshot({path:info.outputPath('journal-research-filter-393.png')});
});
