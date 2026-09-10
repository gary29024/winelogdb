// @vitest-environment jsdom
import { act,cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { VintageCheck } from '../../src/features/maturity/VintageCheck';
import { getVintageWindow,lookUpVintageWindow,observeVintageResearch,type SavedVintageResearch } from '../../src/features/maturity/api';
import { maturityPair,type VintageWindow } from '../../src/lib/maturity/vintageWindow';

vi.mock('../../src/features/maturity/api',()=>({getVintageWindow:vi.fn(),lookUpVintageWindow:vi.fn(),observeVintageResearch:vi.fn()}));
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
/** A cached read carries the saved window and any lookup still running. */
const saved=(window:VintageWindow|null,job:{id:string;status:'queued'|'running'}|null=null)=>
  ({window,job:job&&{...job,window:null,error:null}});
const flush=()=>act(async()=>{await vi.advanceTimersByTimeAsync(300)});

describe('vintage research belongs to the displayed cell',()=>{
  beforeEach(()=>{vi.useFakeTimers();read.mockReset().mockResolvedValue(saved(null));lookup.mockReset()});
  afterEach(()=>{cleanup();vi.useRealTimers()});

  it('shows quality without inventing a drinking window, and labels its origin',async()=>{
    read.mockResolvedValue(saved(found));
    const {container}=render(<VintageCheck wine={wine}/>);
    await flush();
    expect(screen.getByText('93')).toBeTruthy();
    expect(screen.getByText(/WineLog estimate/)).toBeTruthy();
    expect(screen.getByText(/AI-assessed confidence/)).toBeTruthy();
    expect(container.querySelector('.vintage-researched .maturity-window')).toBeNull();
  });

  it('removes old research immediately when the vintage changes',async()=>{
    read.mockResolvedValueOnce(saved(found));
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
    const signal=lookup.mock.calls[0][2];
    expect(signal?.aborted).toBe(false);
    rerender(<VintageCheck wine={{...wine,vintage:2020}} onResearched={onResearched}/>);
    expect(signal?.aborted).toBe(true);
    await flush();
    await act(async()=>pending.resolve({window:found,cached:false}));
    expect(screen.queryByText('93')).toBeNull();
    expect(screen.getByRole('button',{name:'Look up 2020'})).toBeTruthy();
    expect(onResearched).not.toHaveBeenCalled();
  });

  it('waits for a saved read before offering a new lookup',async()=>{
    const pending=deferred<SavedVintageResearch>();
    read.mockReturnValue(pending.promise);
    lookup.mockResolvedValue({window:found,cached:false});
    render(<VintageCheck wine={wine}/>);
    await flush();
    expect(screen.getByRole('status').textContent).toBe('Checking saved research…');
    expect(screen.queryByRole('button',{name:'Look up 2019'})).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
    await act(async()=>pending.resolve(saved(null)));
    fireEvent.click(screen.getByRole('button',{name:'Look up 2019'}));
    await act(async()=>{});
    expect(screen.getByText('93')).toBeTruthy();
  });

  it('retains research when the wine changes within the same regional cell',async()=>{
    read.mockResolvedValue(saved(found));
    const {rerender}=render(<VintageCheck wine={wine}/>);
    await flush();
    rerender(<VintageCheck wine={{...wine,appellation:'Morey-Saint-Denis'}}/>);
    await flush();
    expect(screen.getByText('93')).toBeTruthy();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('offers a saved-read retry rather than a paid lookup after a read failure',async()=>{
    read.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(saved(found));
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
    lookup.mockReturnValue(pending.promise);read.mockResolvedValue(saved(found));
    const {container}=render(<VintageCheck wine={wine} initialWindow={found}/>);
    await flush();
    fireEvent.click(screen.getByText(/Evidence & sources/));
    fireEvent.click(screen.getByRole('button',{name:'Refresh research'}));
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000)});
    expect(screen.getByRole('status').textContent).toBe('Researching vintage…');
    expect(container.querySelector('.vintage-elapsed')?.textContent).toBe('2s');
    expect(container.querySelector('.vintage-elapsed')?.getAttribute('aria-hidden')).toBe('true');
    await act(async()=>pending.reject(new Error('upstream unavailable')));
    expect(screen.getByRole('alert').textContent).toMatch(/previous research is still shown/);
    expect(screen.getByText('93')).toBeTruthy();
  });

  it.each(['queued','running'] as const)('keeps previous research and describes the last observed %s state honestly',async pendingStatus=>{
    lookup.mockResolvedValue({window:null,cached:false,pending:true,pendingStatus});
    read.mockResolvedValue(saved(found));
    render(<VintageCheck wine={wine} initialWindow={found}/>);
    await flush();
    fireEvent.click(screen.getByText(/Evidence & sources/));
    fireEvent.click(screen.getByRole('button',{name:'Refresh research'}));
    await act(async()=>{});
    expect(screen.getByRole('status').textContent).toMatch(pendingStatus==='queued'?/waiting in the research queue/:/may have been interrupted/);
    expect(screen.getByRole('status').textContent).not.toMatch(/continues in the background/);
    expect(screen.getByText('93')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // A seeded cell still reads once, because the seed cannot say whether a
  // lookup is already running. It must never start one by itself.
  it('reads a seeded cell once to find any running lookup, and starts none',async()=>{
    read.mockResolvedValue(saved(null));
    render(<VintageCheck wine={wine} initialWindow={null}/>);
    await flush();
    expect(screen.getByRole('button',{name:'Look up 2019'})).toBeTruthy();
    expect(read).toHaveBeenCalledOnce();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('picks a running lookup back up instead of offering to pay for it again',async()=>{
    read.mockResolvedValue(saved(null,{id:'job',status:'running'}));
    const observe=vi.mocked(observeVintageResearch);
    const pending=deferred<Awaited<ReturnType<typeof observeVintageResearch>>>();
    observe.mockReturnValue(pending.promise);
    const onResearched=vi.fn();
    render(<VintageCheck wine={wine} onResearched={onResearched}/>);
    await flush();
    // The button is the bug: it used to be offered for work already paid for.
    expect(screen.queryByRole('button',{name:'Look up 2019'})).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Researching vintage…');
    expect(observe).toHaveBeenCalledWith('job',expect.anything());
    expect(lookup).not.toHaveBeenCalled();
    await act(async()=>pending.resolve({window:found,cached:false}));
    expect(screen.getByText('93')).toBeTruthy();
    // The cellar list is told, so its card stops showing the stale verdict.
    expect(onResearched).toHaveBeenCalledOnce();
  });

  it('stops observing a resumed lookup when the panel closes, without cancelling it',async()=>{
    read.mockResolvedValue(saved(null,{id:'job',status:'queued'}));
    const observe=vi.mocked(observeVintageResearch);
    let signal:AbortSignal|undefined;
    observe.mockImplementation((_id,given)=>{signal=given;return new Promise(()=>{})});
    const {unmount}=render(<VintageCheck wine={wine}/>);
    await flush();
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
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
    const old=deferred<SavedVintageResearch>();
    read.mockReturnValueOnce(old.promise).mockResolvedValueOnce(saved(null));
    const {rerender}=render(<VintageCheck wine={wine}/>);
    await flush();
    rerender(<VintageCheck wine={{...wine,vintage:2020}}/>);
    await flush();
    await act(async()=>old.resolve(saved(found)));
    expect(screen.queryByText('93')).toBeNull();
    expect(screen.getByRole('button',{name:'Look up 2020'})).toBeTruthy();
  });

  it('does not claim an undated missing quality payload must be a legacy lookup',async()=>{
    read.mockResolvedValue(saved({...found,quality:null}));
    render(<VintageCheck wine={wine}/>);
    await flush();
    expect(screen.queryByText(/predates Vintage Intelligence/)).toBeNull();
    expect(screen.getByText(/No vintage quality assessment/)).toBeTruthy();
  });
});


describe('cache timing and quality presentation',()=>{
  beforeEach(()=>{vi.useFakeTimers();read.mockReset().mockResolvedValue(saved(null))});
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
