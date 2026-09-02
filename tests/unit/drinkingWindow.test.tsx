// @vitest-environment jsdom
import { beforeEach,describe,expect,it } from 'vitest';
import { cleanup,render,screen } from '@testing-library/react';
import { DrinkingWindow } from '../../src/features/maturity/DrinkingWindow';

const barolo=(vintage:number|null)=>({country:'Italy',region:'Piedmont',appellation:'Barolo',
  classification:null,wineStyle:'red',vintage});

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

  it('shrinks to a badge on a list, keeping the window in the title',()=>{
    render(<DrinkingWindow wine={barolo(new Date().getFullYear()-12)} compact/>);
    const badge=screen.getByText('Ready').closest('.maturity-dot');
    expect(String(badge?.getAttribute('title'))).toMatch(/Ready · \d{4}–\d{4}/);
  });
});
