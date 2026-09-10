// @vitest-environment jsdom
import { act,cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { VintageCheck } from '../../src/features/maturity/VintageCheck';
import { getVintageWindow,lookUpVintageWindow } from '../../src/features/maturity/api';
import { maturityPair,type VintageWindow } from '../../src/lib/maturity/vintageWindow';

vi.mock('../../src/features/maturity/api',()=>({getVintageWindow:vi.fn(),lookUpVintageWindow:vi.fn()}));
const wine={country:'France',region:'Burgundy',appellation:'Gevrey-Chambertin',wineStyle:'red',vintage:2019};
const found:VintageWindow={...wine,shiftFrom:null,shiftTo:null,note:'No precise window supported.',
  sources:[{title:'Vintage report',url:'https://example.com/report'}],model:'model',researchedAt:'2026-09-10',
  quality:{score:93,confidence:'medium',consensus:'A structured vintage.',strengths:['Freshness'],cautions:[]}};
function deferred<T>(){
  let resolve!:(value:T)=>void;
  let reject!:(error:Error)=>void;
  const promise=new Promise<T>((done,fail)=>{resolve=done;reject=fail});
  return {promise,resolve,reject};
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

  it('waits for a saved read before offering a new lookup',async()=>{
    const pending=deferred<VintageWindow|null>();
    read.mockReturnValue(pending.promise);
    lookup.mockResolvedValue({window:found,cached:false});
    render(<VintageCheck wine={wine}/>);
    await flush();
    expect(screen.getByRole('status').textContent).toBe('Checking saved research…');
    expect(screen.queryByRole('button',{name:'Look up 2019'})).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
    await act(async()=>pending.resolve(null));
    fireEvent.click(screen.getByRole('button',{name:'Look up 2019'}));
    await act(async()=>{});
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

  it('offers a saved-read retry rather than a paid lookup after a read failure',async()=>{
    read.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(found);
    render(<VintageCheck wine={wine}/>);
    await flush();
    expect(screen.getByRole('alert').textContent).toMatch(/Could not load saved research/);
    expect(screen.queryByRole('button',{name:'Look up 2019'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Retry saved research'}));
    await flush();
    expect(screen.getByText('93')).toBeTruthy();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('keeps the previous result on refresh failure and exposes elapsed time while waiting',async()=>{
    const pending=deferred<Awaited<ReturnType<typeof lookUpVintageWindow>>>();
    lookup.mockReturnValue(pending.promise);
    const {container}=render(<VintageCheck wine={wine} initialWindow={found}/>);
    fireEvent.click(screen.getByText(/Evidence & sources/));
    fireEvent.click(screen.getByRole('button',{name:'Refresh research'}));
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000)});
    expect(screen.getByRole('status').textContent).toBe('Researching vintage…');
    expect(container.querySelector('.vintage-elapsed')?.textContent).toBe('2s');
    expect(container.querySelector('.vintage-elapsed')?.getAttribute('aria-hidden')).toBe('true');
    await act(async()=>pending.reject(new Error('upstream unavailable')));
    expect(screen.getByRole('alert').textContent).toMatch(/previous research is still shown/);
    expect(screen.getByText('93')).toBeTruthy();
    expect(read).not.toHaveBeenCalled();
  });

  it('uses a known cellar cache miss without a redundant read or automatic lookup',async()=>{
    render(<VintageCheck wine={wine} initialWindow={null}/>);
    await flush();
    expect(screen.getByRole('button',{name:'Look up 2019'})).toBeTruthy();
    expect(read).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('leads with researched readiness and shows the typical window as a comparison',()=>{
    const currentWine={...wine,vintage:new Date().getFullYear()-12};
    const research={...found,vintage:currentWine.vintage,shiftFrom:20,shiftTo:20};
    const pair=maturityPair(currentWine,research);
    const {container}=render(<VintageCheck wine={currentWine} initialWindow={research}/>);
    const headline=container.querySelector('.maturity-line') as HTMLElement;
    expect(within(headline).getByText('Too young')).toBeTruthy();
    expect(headline.textContent).toContain(`Drink ${pair.researched?.from}–${pair.researched?.to}`);
    expect(screen.getByText(`Typical window: ${pair.calculated?.from}–${pair.calculated?.to}`)).toBeTruthy();
    expect(screen.getByText('Burgundy · Red · '+currentWine.vintage)).toBeTruthy();
  });

  it('falls back consistently when a shared research shift inverts this wine’s window',()=>{
    const research={...found,shiftFrom:40,shiftTo:-40};
    const {container}=render(<VintageCheck wine={wine} initialWindow={research}/>);
    expect(container.querySelector('.vintage-comparison')).toBeNull();
    expect(screen.getByText(/a rule of thumb, not research/)).toBeTruthy();
  });

  it('ignores a slow saved read after the user changes vintage',async()=>{
    const old=deferred<VintageWindow|null>();
    read.mockReturnValueOnce(old.promise).mockResolvedValueOnce(null);
    const {rerender}=render(<VintageCheck wine={wine}/>);
    await flush();
    rerender(<VintageCheck wine={{...wine,vintage:2020}}/>);
    await flush();
    await act(async()=>old.resolve(found));
    expect(screen.queryByText('93')).toBeNull();
    expect(screen.getByRole('button',{name:'Look up 2020'})).toBeTruthy();
  });

  it('does not claim an undated missing quality payload must be a legacy lookup',async()=>{
    read.mockResolvedValue({...found,quality:null});
    render(<VintageCheck wine={wine}/>);
    await flush();
    expect(screen.queryByText(/predates Vintage Intelligence/)).toBeNull();
    expect(screen.getByText(/No vintage quality assessment/)).toBeTruthy();
  });
});


describe('cache timing and quality presentation',()=>{
  beforeEach(()=>{vi.useFakeTimers();read.mockReset().mockResolvedValue(null)});
  afterEach(()=>{cleanup();vi.useRealTimers()});
  it('reads immediately when opening an unseeded detail',async()=>{
    render(<VintageCheck wine={wine}/>);
    expect(read).toHaveBeenCalledTimes(1);
    await act(async()=>{});
  });
  it('debounces changing cells only when the editable form requests it',async()=>{
    const {rerender}=render(<VintageCheck wine={wine} debounceMs={300}/>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(200)});
    rerender(<VintageCheck wine={{...wine,vintage:2020}} debounceMs={300}/>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(200)});
    expect(read).not.toHaveBeenCalled();
    await flush();
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][0].vintage).toBe(2020);
  });
  it('deduplicates evidence and does not equate a below-scale score with missing evidence',()=>{
    render(<VintageCheck wine={wine} initialWindow={{...found,quality:{...found.quality!,score:null,
      consensus:'Worse than the supported numeric scale.',strengths:['Freshness','Freshness'],cautions:['Rot','Rot']}}}/>);
    expect(screen.getAllByText('Freshness')).toHaveLength(1);
    expect(screen.getAllByText('Rot')).toHaveLength(1);
    expect(screen.getByText('Worse than the supported numeric scale.')).toBeTruthy();
    expect(screen.queryByText(/available evidence did not support/)).toBeNull();
  });
  it('does not encourage another paid search when quality is absent',()=>{
    render(<VintageCheck wine={wine} initialWindow={{...found,quality:null}}/>);
    expect(screen.getByText('No vintage quality assessment is stored with this lookup.')).toBeTruthy();
    expect(screen.queryByText(/Refresh it to request one/)).toBeNull();
  });
});
