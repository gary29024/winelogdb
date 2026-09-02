// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { VintageCheck } from '../../src/features/maturity/VintageCheck';

const clos={country:'France',region:'Burgundy',appellation:'Chambertin-Clos de Bèze',
  classification:'grand_cru',wineStyle:'red',vintage:2011};

// Stored as the shift the year applies, not as absolute years: the cell is
// keyed on the region, and a Burgundy 2011 that ran two years late runs two
// years late for the grand cru and the village wine alike.
const stored={
  country:'France',region:'Burgundy',appellation:null,vintage:2011,wineStyle:'red',
  shiftFrom:2,shiftTo:0,model:'gemini-3.7-flash',
  note:'The 2011 growing season experienced an unusually warm spring followed by a cool, rainy July, '
    +'necessitating rigorous fruit sorting ahead of an early September harvest, and the wines need a '
    +'little longer to shed their initial tightness than the run of the appellation.',
  sources:[{title:'CellarTracker',url:'https://example.test/a'},{title:'Vinous',url:'https://example.test/b'}],
  researchedAt:'2026-09-02T01:00:00.000Z'
};

const answer=(window:unknown)=>vi.stubGlobal('fetch',vi.fn(async()=>
  new Response(JSON.stringify({window}),{status:200,headers:{'content-type':'application/json'}})));

describe('the vintage block above the form',()=>{
  beforeEach(()=>cleanup());
  afterEach(()=>vi.unstubAllGlobals());

  it('keeps the two windows in one box rather than two stacked cards',async()=>{
    // The usual window and what the year did to it are the same answer. Two
    // bordered cards, each with its own padding, cost a phone most of a screen.
    answer(stored);
    const {container}=render(<VintageCheck wine={clos}/>);
    await waitFor(()=>expect(container.querySelector('.vintage-researched')).not.toBeNull());
    const box=container.querySelector('.vintage-check')!;
    expect(box.querySelector('.maturity-line')).not.toBeNull();
    expect(box.querySelector('.vintage-researched')).not.toBeNull();
    const css=(await import('node:fs')).readFileSync('src/maturity.css','utf8');
    expect(css).toMatch(/\.vintage-check\{[^}]*border:1px solid/);
    expect(css,'the inner window drops its own border').toMatch(/\.vintage-check>\.maturity-line\{[^}]*border:0/);
  });

  it('leads with the years and folds the prose away',async()=>{
    // The note ran to six lines on a phone, above a form that then could not be
    // reached. The answer - the years and the shift - stays in the open.
    answer(stored);
    render(<VintageCheck wine={clos}/>);
    await screen.findByText('Drink 2021–2036');
    expect(screen.getByText(/on the usual/)).toBeTruthy();
    const note=screen.getByText(/unusually warm spring/);
    const folded=note.closest('details')!;
    expect(folded,'the note lives inside the disclosure').not.toBeNull();
    expect(folded.open,'and it starts closed').toBe(false);
    // The sources went in with it, so one summary line carries both
    expect(folded.querySelector('summary')!.textContent).toBe('Why this vintage · 2 sources · 2026-09-02');
    expect(folded.querySelectorAll('a')).toHaveLength(2);
  });

  it('offers a fresh search on a cell that already has an answer',async()=>{
    // Reported as: no button to do the search again. A stored note written
    // about the bottling that happened to ask - "2011 Chambertin-Clos de Bèze"
    // on a Charmes-Chambertin - was unreplaceable, because the button only
    // existed while there was nothing there.
    const posts:Array<Record<string,unknown>>=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      if(init?.method==='POST')posts.push(JSON.parse(String(init.body)) as Record<string,unknown>);
      return new Response(JSON.stringify({window:stored}),{status:200,headers:{'content-type':'application/json'}});
    }));
    render(<VintageCheck wine={clos}/>);
    const again=await screen.findByRole('button',{name:'Look it up again'});
    // and it says what pressing it costs, and who else it changes the answer for
    expect(screen.getByText(/Spends one search/)).toBeTruthy();
    fireEvent.click(again);
    await waitFor(()=>expect(posts).toHaveLength(1));
    expect(posts[0].refresh,'a refresh, not another read of the cache').toBe(true);
  });

  it('still offers the search when nothing has been looked up',async()=>{
    answer(null);
    render(<VintageCheck wine={clos}/>);
    expect(await screen.findByRole('button',{name:'Look up 2011'})).toBeTruthy();
    // and the calculated window is there either way
    expect(screen.getByText(/a rule of thumb, not research/)).toBeTruthy();
  });
});
