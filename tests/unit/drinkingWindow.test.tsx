// @vitest-environment jsdom
import { beforeEach,describe,expect,it } from 'vitest';
import { cleanup,render,screen } from '@testing-library/react';
import { DrinkingWindow } from '../../src/features/maturity/DrinkingWindow';
import type { VintageWindow } from '../../src/lib/maturity/vintageWindow';

const lookedUp=(shiftFrom:number,shiftTo:number):VintageWindow=>({
  country:'Italy',region:'Piedmont',appellation:null,vintage:new Date().getFullYear()-12,wineStyle:'red',
  shiftFrom,shiftTo,note:'A cool year.',sources:[{title:'A source',url:'https://example.test/a'}],
  model:'gemini-3.7-flash',researchedAt:'2026-09-02T01:00:00.000Z'
});

const barolo=(vintage:number|null)=>({country:'Italy',region:'Piedmont',appellation:'Barolo',
  classification:null,wineStyle:'red',vintage});

const windowOf=(container:HTMLElement)=>container.querySelector('.maturity-dot-window')!.textContent!;

describe('the drinking window on a wine',()=>{
  beforeEach(()=>cleanup());

  it('says when to open it, and where the figure came from',()=>{
    render(<DrinkingWindow wine={barolo(new Date().getFullYear()-12)}/>);
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(screen.getByText(/Typical for Barolo/)).toBeTruthy();
  });

  it('never lets a rule of thumb pass for research',()=>{
    // The window is derived from the place and the style. Saying so is the
    // difference between a useful hint and a figure someone acts on.
    render(<DrinkingWindow wine={barolo(new Date().getFullYear()-12)}/>);
    expect(screen.getByText(/a rule of thumb, not research/)).toBeTruthy();
  });

  it('counts the years down for a wine that is not ready',()=>{
    render(<DrinkingWindow wine={barolo(new Date().getFullYear()-4)}/>);
    expect(screen.getByText('Too young')).toBeTruthy();
    expect(screen.getByText(/Opens in 4 years/)).toBeTruthy();
  });

  it('renders nothing at all for a wine with no vintage',()=>{
    const {container}=render(<DrinkingWindow wine={barolo(null)}/>);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing where there is no place and no style to go on',()=>{
    const {container}=render(<DrinkingWindow wine={{country:null,region:null,appellation:null,classification:null,wineStyle:null,vintage:2015}}/>);
    expect(container.firstChild).toBeNull();
  });

  it('prefers the window a search was already paid for',()=>{
    // The rule of thumb is the fallback, not the answer. Where a year has been
    // looked up, the list shows what the lookup said - otherwise the search was
    // spent and the card went on quoting the table beside it.
    const wine=barolo(new Date().getFullYear()-12);
    const plain=windowOf(render(<DrinkingWindow wine={wine} compact/>).container);
    const [from,to]=plain.split('–').map(Number);
    cleanup();
    const {container}=render(<DrinkingWindow wine={wine} compact researched={lookedUp(3,-2)}/>);
    const badge=container.querySelector('.maturity-dot')!;
    expect(badge.querySelector('.maturity-dot-window')!.textContent).toBe(`${from+3}–${to-2}`);
    expect(String(badge.getAttribute('title'))).toMatch(/looked up$/);
    expect(badge.querySelector('.maturity-dot-researched'),'and it is marked as researched').not.toBeNull();
  });

  it('works the readiness out again from the years it moved to',()=>{
    // A shift that has not opened yet makes the bottle too young, whatever the
    // table said. Carrying the old verdict across would put "Ready" next to a
    // window that has not started.
    const year=new Date().getFullYear();
    render(<DrinkingWindow wine={barolo(year-12)} compact researched={lookedUp(9,9)}/>);
    expect(screen.getByText('Too young')).toBeTruthy();
  });

  it('keeps the rule of thumb where the shift is missing or nonsense',()=>{
    // A stored row with no shift, and one that would end the window before it
    // opens, both fall back rather than printing an impossible answer.
    const wine=barolo(new Date().getFullYear()-12);
    const plain=windowOf(render(<DrinkingWindow wine={wine} compact/>).container);
    cleanup();
    const {container}=render(<DrinkingWindow wine={wine} compact researched={{...lookedUp(0,0),shiftFrom:null,shiftTo:null}}/>);
    expect(container.querySelector('.maturity-dot-window')!.textContent).toBe(plain);
    cleanup();
    const inverted=render(<DrinkingWindow wine={wine} compact researched={lookedUp(30,-30)}/>);
    expect(inverted.container.querySelector('.maturity-dot-window')!.textContent).toBe(plain);
    expect(inverted.container.querySelector('.maturity-dot-researched')).toBeNull();
  });

  it('shrinks to a badge on a list, and still says by when',()=>{
    // "Ready" answers whether to open it; the years answer the question
    // underneath, which is the one a cellar list is being scanned for. They
    // used to live in the title attribute, where a phone cannot reach them.
    render(<DrinkingWindow wine={barolo(new Date().getFullYear()-12)} compact/>);
    const badge=screen.getByText('Ready').closest('.maturity-dot')!;
    expect(badge.textContent).toMatch(/Ready\s*\d{4}–\d{4}/);
    expect(badge.querySelector('.maturity-dot-window')?.textContent).toMatch(/^\d{4}–\d{4}$/);
    expect(String(badge.getAttribute('title'))).toMatch(/Ready · \d{4}–\d{4}/);
  });
});
