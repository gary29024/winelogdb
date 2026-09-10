// @vitest-environment jsdom
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { VintageCheck } from '../../src/features/maturity/VintageCheck';
import { getVintageWindow,lookUpVintageWindow } from '../../src/features/maturity/api';
import type { VintageWindow } from '../../src/lib/maturity/vintageWindow';

vi.mock('../../src/features/maturity/api',()=>({getVintageWindow:vi.fn(),lookUpVintageWindow:vi.fn()}));
const wine={country:'France',region:'Burgundy',appellation:'Gevrey-Chambertin',wineStyle:'red',vintage:2019};
const found:VintageWindow={...wine,shiftFrom:null,shiftTo:null,note:'No precise window supported.',
  sources:[{title:'Vintage report',url:'https://example.com/report'}],model:'model',researchedAt:'2026-09-10',
  quality:{score:93,confidence:'medium',consensus:'A structured vintage.',strengths:['Freshness'],cautions:[]}};
function deferred<T>(){
  let resolve!:(value:T)=>void;
  const promise=new Promise<T>(done=>{resolve=done});
  return {promise,resolve};
}
const read=vi.mocked(getVintageWindow),lookup=vi.mocked(lookUpVintageWindow);
const flush=()=>act(async()=>{await vi.advanceTimersByTimeAsync(300)});

describe('vintage research belongs to the displayed cell',()=>{
  beforeEach(()=>{vi.useFakeTimers();read.mockReset().mockResolvedValue(null);lookup.mockReset()});
  afterEach(()=>{cleanup();vi.useRealTimers()});

  it('shows quality without inventing a drinking window, and labels its origin',async()=>{
    read.mockResolvedValue(found);
    const {container}=render(<VintageCheck wine={wine}/>);
    await flush();
    expect(screen.getByText('93')).toBeTruthy();
    expect(screen.getByText(/WineLog estimate/)).toBeTruthy();
    expect(screen.getByText(/AI-assessed confidence/)).toBeTruthy();
    expect(container.querySelector('.vintage-researched .maturity-window')).toBeNull();
  });

  it('removes old research immediately when the vintage changes',async()=>{
    read.mockResolvedValueOnce(found);
    const {rerender}=render(<VintageCheck wine={wine}/>);
    await flush();
    expect(screen.getByText('93')).toBeTruthy();
    rerender(<VintageCheck wine={{...wine,vintage:2020}}/>);
    expect(screen.queryByText('93')).toBeNull();
    await flush();
    expect(screen.queryByText('93')).toBeNull();
  });

  it('ignores a lookup result for a cell the user has left',async()=>{
    const pending=deferred<Awaited<ReturnType<typeof lookUpVintageWindow>>>();
    lookup.mockReturnValue(pending.promise);
    const onResearched=vi.fn();
    const {rerender}=render(<VintageCheck wine={wine} onResearched={onResearched}/>);
    await flush();
    fireEvent.click(screen.getByRole('button',{name:'Look up 2019'}));
    rerender(<VintageCheck wine={{...wine,vintage:2020}} onResearched={onResearched}/>);
    await flush();
    await act(async()=>pending.resolve({window:found,cached:false}));
    expect(screen.queryByText('93')).toBeNull();
    expect(screen.getByRole('button',{name:'Look up 2020'})).toBeTruthy();
    expect(onResearched).not.toHaveBeenCalled();
  });

  it('does not overwrite fresh research with an older cache read',async()=>{
    const pending=deferred<VintageWindow|null>();
    read.mockReturnValue(pending.promise);
    lookup.mockResolvedValue({window:found,cached:false});
    render(<VintageCheck wine={wine}/>);
    await flush();
    fireEvent.click(screen.getByRole('button',{name:'Look up 2019'}));
    await act(async()=>{});
    expect(screen.getByText('93')).toBeTruthy();
    await act(async()=>pending.resolve(null));
    expect(screen.getByText('93')).toBeTruthy();
  });

  it('retains research when the wine changes within the same regional cell',async()=>{
    read.mockResolvedValue(found);
    const {rerender}=render(<VintageCheck wine={wine}/>);
    await flush();
    rerender(<VintageCheck wine={{...wine,appellation:'Morey-Saint-Denis'}}/>);
    await flush();
    expect(screen.getByText('93')).toBeTruthy();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('does not claim an undated missing quality payload must be a legacy lookup',async()=>{
    read.mockResolvedValue({...found,quality:null});
    render(<VintageCheck wine={wine}/>);
    await flush();
    expect(screen.queryByText(/predates Vintage Intelligence/)).toBeNull();
    expect(screen.getByText(/No vintage quality assessment/)).toBeTruthy();
  });
});
