// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,useLocation,useSearchParams } from 'react-router-dom';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { JournalSearchInput } from '../../src/features/wines/JournalSearchInput';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

let root:Root|null=null,host:HTMLDivElement|null=null;

beforeEach(()=>{vi.useFakeTimers()});
afterEach(()=>{
  act(()=>root?.unmount());host?.remove();root=null;host=null;
  vi.useRealTimers();vi.restoreAllMocks();
});

function LocationProbe(){const location=useLocation();return <output data-testid="location-search">{location.search}</output>}
function Harness(){
  const [params]=useSearchParams();
  return <><JournalSearchInput value={params.get('query')??''} resetSeq={0}/><LocationProbe/></>;
}

function renderInput(initial='/journal'){
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  act(()=>root!.render(<MemoryRouter initialEntries={[initial]}><Harness/></MemoryRouter>));
  return host.querySelector('[aria-label="Search wines"]') as HTMLInputElement;
}

function type(input:HTMLInputElement,value:string){
  act(()=>{
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')!.set!;
    setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));
  });
}

const query=()=>new URLSearchParams(host!.querySelector('[data-testid="location-search"]')!.textContent??'');

describe('Journal semantic search input',()=>{
  it('keeps ordinary identity searches on the 300ms live debounce',()=>{
    const input=renderInput();
    type(input,'Nicole Lamarche');
    act(()=>vi.advanceTimersByTime(299));expect(query().get('query')).toBeNull();
    act(()=>vi.advanceTimersByTime(1));expect(query().get('query')).toBe('Nicole Lamarche');expect(query().get('semantic')).toBeNull();
  });

  it('keeps descriptive typing live but lexical until Smart search is chosen',()=>{
    const input=renderInput();
    type(input,'floral elegant Burgundy');
    act(()=>vi.advanceTimersByTime(300));
    expect(query().get('query')).toBe('floral elegant Burgundy');
    expect(query().get('semantic')).toBe('0');
    expect(host!.querySelector('[aria-label="Run smart search"]')?.textContent).toContain('Smart search');
    expect(host!.querySelector('.journal-semantic-hint')).toBeNull();
  });

  it('makes a cold Smart search honest and retryable, then returns to lexical mode after editing',()=>{
    const input=renderInput();
    type(input,'floral elegant Burgundy');act(()=>vi.advanceTimersByTime(300));
    act(()=>host!.querySelector<HTMLButtonElement>('[aria-label="Run smart search"]')!.click());
    expect(query().get('query')).toBe('floral elegant Burgundy');expect(query().get('semantic')).toBe('1');
    expect(host!.querySelector('[aria-label="Run smart search"]')?.textContent).toContain('Smart search again');
    expect(host!.querySelector('.journal-semantic-hint')?.textContent).toContain('builds its journal index in the background');

    // Same text, new positive attempt: this is a real navigation/refetch rather
    // than a disabled success state while the background index is still warm.
    act(()=>host!.querySelector<HTMLButtonElement>('[aria-label="Run smart search"]')!.click());
    expect(query().get('semantic')).toBe('2');

    type(input,'silky perfumed pinot');act(()=>vi.advanceTimersByTime(300));
    expect(query().get('query')).toBe('silky perfumed pinot');expect(query().get('semantic')).toBe('0');
    expect(host!.querySelector('.journal-semantic-hint')).toBeNull();
    act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
    expect(query().get('query')).toBe('silky perfumed pinot');expect(query().get('semantic')).toBe('1');
  });
});
