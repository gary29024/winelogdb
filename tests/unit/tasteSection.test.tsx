// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { JourneyData } from '../../src/features/journey/api';
import { TasteSection } from '../../src/features/journey/TasteSection';

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

function render(data:JourneyData){
  host=document.createElement('div');
  document.body.appendChild(host);
  root=createRoot(host);
  act(()=>{root!.render(<MemoryRouter><TasteSection data={data}/></MemoryRouter>)});
  return host;
}

const text=(scope:Element)=>scope.textContent??'';

afterEach(()=>{
  act(()=>root?.unmount());
  host?.remove();
  root=null;host=null;
});

describe('Your taste, for a journal that rarely scores wines',()=>{
  it('leads with signals that come free with logging a bottle',()=>{
    const page=render(journal());
    expect(text(page)).toContain('Go-to producers');
    expect(text(page)).toContain('Domaine Dujac');
    expect(text(page)).toContain('Most hearted');
    expect(text(page)).toContain('Rhythm');
    expect(text(page)).toContain('How old wines are when you open them');
    expect(text(page)).toContain('The mix');
  });

  it('keeps every list to three, so the tiles stay small',()=>{
    const many=journal({producers:Array.from({length:8},(_,i)=>({producer:`Producer ${i}`,wines:9-i,ratedWines:0,averageRating:null,favorites:0,lastTasted:null}))});
    const producers=render(many).querySelector('.taste-tile .taste-rank')!;
    expect(producers.querySelectorAll('li')).toHaveLength(3);
  });

  it('colors style slices by wine style and renders the Village share',()=>{
    const page=render(journal());
    const swatches=[...page.querySelectorAll('.taste-legend .taste-swatch')].map(swatch=>swatch.className);
    expect(swatches).toContain('taste-swatch mix-style-red');
    expect(swatches).toContain('taste-swatch mix-style-white');
    const village=page.querySelector('.taste-bar .taste-cru-village') as HTMLElement;
    expect(village.style.width).toBe('58%');
  });

  it('names every month of the rhythm chart, empty ones included',()=>{
    const page=render(journal());
    const chart=[...page.querySelectorAll('.taste-charts .taste-mini-chart')][1];
    const label=chart.getAttribute('aria-label')??'';
    expect(label).toMatch(/August 2026: 5/);
    expect(label).toMatch(/July 2026: 4/);
    expect(label).toMatch(/: 0/);
  });

  it('hides the rating and structure readings and says so once',()=>{
    const page=render(journal());
    expect(text(page)).not.toContain('Your palate structure');
    expect(text(page)).not.toContain('Rated highest');
    expect(page.querySelectorAll('.taste-gate-note')).toHaveLength(1);
    expect(text(page)).toContain('Rating and structure insights appear');
  });

  it('shows how old the bottles are instead of an empty average rating',()=>{
    const page=render(journal());
    expect(text(page)).toContain('Typical age opened');
    expect(text(page)).toContain('4 yrs');
  });

  it('ranks favorites by rate, so a grape logged less often can lead',()=>{
    const page=render(journal());
    const hearted=[...page.querySelectorAll('.taste-tile')].find(tile=>text(tile).includes('Most hearted'))!;
    // Riesling is 6 of 9; Pinot Noir is 9 of 22. More hearts, lower rate.
    expect(text(hearted)).toContain('Riesling');
    expect(text(hearted)).not.toContain('Pinot Noir');
  });
});

describe('Your taste, for a journal that does score wines',()=>{
  const scored=journal({summary:{...journal().summary,ratedWines:64,averageRating:92.4,structuredTastings:40},
    styles:[{style:'red',wines:48,ratedWines:40,averageRating:91.2,favorites:9},{style:'white',wines:30,ratedWines:24,averageRating:93.1,favorites:8}],
    structures:[{rating:95,structure:{acidity:'high',body:'full'}},{rating:88,structure:{acidity:'medium',body:'medium'}}]});

  it('brings the rating and structure readings back',()=>{
    const page=render(scored);
    expect(text(page)).toContain('Your palate structure');
    expect(page.querySelectorAll('.taste-gate-note')).toHaveLength(0);
  });

  it('names the best-rated style',()=>{
    const tile=[...render(scored).querySelectorAll('.taste-tile')].find(item=>text(item).includes('Rated highest'))!;
    expect(text(tile)).toContain('white');
    expect(text(tile)).toContain('93.1');
  });
});

describe('the Passport stays about the wine',()=>{
  it('never carries the AI spend card, which lives in Owner controls now',()=>{
    for(const file of ['src/features/journey/PassportPage.tsx','src/features/journey/TasteSection.tsx'])
      expect(readFileSync(file,'utf8')).not.toContain('AiSpendCard');
    expect(readFileSync('src/features/auth/AdminPage.tsx','utf8')).toMatch(/section==='spend'&&<AiSpendCard\/>/);
  });
});
