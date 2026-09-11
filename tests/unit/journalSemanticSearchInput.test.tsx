// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
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

function renderInput(onCommit:ReturnType<typeof vi.fn>,value=''){
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  act(()=>root!.render(<JournalSearchInput value={value} resetSeq={0} onCommit={onCommit}/>));
  return host.querySelector('[aria-label="Search wines"]') as HTMLInputElement;
}

function type(input:HTMLInputElement,value:string){
  act(()=>{
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')!.set!;
    setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));
  });
}

describe('Journal semantic search input',()=>{
  it('keeps ordinary identity searches on the 300ms debounce',()=>{
    const onCommit=vi.fn(),input=renderInput(onCommit);
    type(input,'Nicole Lamarche');
    act(()=>vi.advanceTimersByTime(299));expect(onCommit).not.toHaveBeenCalled();
    act(()=>vi.advanceTimersByTime(1));expect(onCommit).toHaveBeenCalledWith('Nicole Lamarche');
  });

  it('does not auto-submit a descriptive query after typing pauses',()=>{
    const onCommit=vi.fn(),input=renderInput(onCommit);
    type(input,'floral elegant Burgundy');
    act(()=>vi.advanceTimersByTime(2000));
    expect(onCommit).not.toHaveBeenCalled();
    expect(host!.querySelector('[aria-label="Run semantic search"]')).not.toBeNull();
  });

  it('submits a descriptive query only on Search or Enter',()=>{
    const onCommit=vi.fn(),input=renderInput(onCommit);
    type(input,'floral elegant Burgundy');
    act(()=>host!.querySelector<HTMLButtonElement>('[aria-label="Run semantic search"]')!.click());
    expect(onCommit).toHaveBeenCalledTimes(1);expect(onCommit).toHaveBeenLastCalledWith('floral elegant Burgundy');

    onCommit.mockClear();type(input,'silky perfumed pinot');
    act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
    expect(onCommit).toHaveBeenCalledTimes(1);expect(onCommit).toHaveBeenLastCalledWith('silky perfumed pinot');
  });
});
