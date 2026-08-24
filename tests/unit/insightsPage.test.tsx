// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';
import type { JourneyData } from '../../src/features/journey/api';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const journal=(over:Partial<JourneyData>={}):JourneyData=>({
  summary:{totalWines:82,producers:54,countries:6,regions:19,appellations:31,vintages:14,
    favorites:17,averageRating:null,ratedWines:2,pricedWines:24,structuredTastings:1},
  countries:[{country:'France',wines:34,producers:20,appellations:18,averageRating:null}],
  regions:[{country:'France',region:'Burgundy',wines:18,producers:9,appellations:7,averageRating:null,favorites:7},
    {country:'Germany',region:'Mosel',wines:6,producers:3,appellations:2,averageRating:null,favorites:1}],
  appellations:[],
  styles:[{style:'red',wines:48,ratedWines:2,averageRating:null,favorites:9},
    {style:'white',wines:30,ratedWines:0,averageRating:null,favorites:8}],
  producers:[{producer:'Domaine Dujac',wines:6,ratedWines:0,averageRating:null,favorites:3,lastTasted:'2026-08-10'},
    {producer:'Keller',wines:4,ratedWines:0,averageRating:null,favorites:2,lastTasted:'2026-07-02'}],
  currencies:[{currency:'EUR',wines:24,averagePrice:68,averageRating:null}],
  years:[{year:'2026',wines:41,ratedWines:2,averageRating:null}],
  structures:[],
  grapes:[{grape:'Pinot Noir',wines:22,favorites:9},{grape:'Riesling',wines:9,favorites:6},
    {grape:'Chardonnay',wines:14,favorites:2}],
  discovery:{tastings:30,newProducers:12,newRegions:5,newCountries:1},
  months:[{month:'2026-08',wines:5,favorites:2},{month:'2026-07',wines:4,favorites:1}],
  classifications:[{classification:'grand_cru',wines:4,favorites:3},{classification:'premier_cru',wines:9,favorites:4},{classification:'village',wines:18,favorites:5}],
  drinkingAges:[{age:2,wines:9},{age:4,wines:14},{age:8,wines:6}],
  recentTastings:[],
  ...over
});

let root:Root|null=null,host:HTMLDivElement|null=null;

async function render(data:JourneyData){
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}})));
  // getJourneyData memoises the payload for thirty seconds, so each render has
  // to start from a fresh module graph or it replays the previous fixture.
  vi.resetModules();
  const {InsightsPage}=await import('../../src/features/journey/InsightsPage');
  host=document.createElement('div');
  document.body.appendChild(host);
  root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter><InsightsPage/></MemoryRouter>)});
  return host;
}

const text=(scope:Element)=>scope.textContent??'';

afterEach(()=>{
  act(()=>root?.unmount());
  host?.remove();
  root=null;host=null;
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Insights for a journal that rarely scores wines',()=>{
  it('leads with signals that come free with logging a bottle',async()=>{
    const page=await render(journal());
    expect(text(page)).toContain('You keep coming back to');
    expect(text(page)).toContain('Domaine Dujac');
    expect(text(page)).toContain('Your favorites, by the numbers');
    expect(text(page)).toContain('Your tasting year');
    expect(text(page)).toContain('When you open them');
    expect(text(page)).toContain('What fills your journal');
  });

  it('hides the rating and structure cards and says so once',async()=>{
    const page=await render(journal());
    expect(text(page)).not.toContain('Typical tasting structure');
    expect(text(page)).not.toContain('What you rate highest');
    expect(page.querySelectorAll('.insights-gate-note')).toHaveLength(1);
    expect(text(page)).toContain('rating and structure insights stay hidden');
  });

  it('shows how old the bottles are instead of an empty average rating',async()=>{
    const tiles=[...(await render(journal())).querySelectorAll('.journey-stat-grid article')];
    expect(tiles.map(tile=>text(tile))).toEqual(['82Wines logged','17Favorites','40%Recent bottles new','4yTypical age opened']);
  });

  it('ranks favorites by rate, so a grape logged less often can lead',async()=>{
    const page=await render(journal());
    const grapes=[...page.querySelectorAll('.favorite-column')][0];
    expect(text(grapes)).toContain('Riesling');
    // Riesling is 6 of 9; Pinot Noir is 9 of 22. More hearts, lower rate.
    expect(text(grapes).indexOf('Riesling')).toBeLessThan(text(grapes).indexOf('Pinot Noir'));
  });
});

describe('Insights for a journal that does score wines',()=>{
  const scored=journal({summary:{...journal().summary,ratedWines:64,averageRating:92.4,structuredTastings:40},
    structures:[{rating:95,structure:{acidity:'high',body:'full'}},{rating:88,structure:{acidity:'medium',body:'medium'}}]});

  it('brings the rating and structure cards back',async()=>{
    const page=await render(scored);
    expect(text(page)).toContain('Typical tasting structure');
    expect(text(page)).toContain('What you rate highest');
    expect(page.querySelectorAll('.insights-gate-note')).toHaveLength(0);
  });

  it('puts the average rating back in the stat row',async()=>{
    const page=await render(scored);
    expect(text(page.querySelector('.journey-stat-grid')!)).toContain('92.4');
  });
});
