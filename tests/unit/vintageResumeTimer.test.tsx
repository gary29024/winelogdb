// @vitest-environment jsdom
import { act,cleanup,render } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { VintageCheck } from '../../src/features/maturity/VintageCheck';
import { getVintageWindow,lookUpVintageWindow,observeVintageResearch } from '../../src/features/maturity/api';

vi.mock('../../src/features/maturity/api',()=>({
  getVintageWindow:vi.fn(),
  lookUpVintageWindow:vi.fn(),
  observeVintageResearch:vi.fn()
}));

const wine={country:'France',region:'Burgundy',appellation:'Gevrey-Chambertin',wineStyle:'red' as const,vintage:2019};

describe('resumed vintage research timer',()=>{
  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T00:00:20.000Z'));
    vi.mocked(getVintageWindow).mockReset().mockResolvedValue({
      window:null,
      job:{id:'job',status:'running',window:null,error:null,createdAt:'2026-09-11T00:00:05.000Z'}
    });
    vi.mocked(lookUpVintageWindow).mockReset();
    vi.mocked(observeVintageResearch).mockReset().mockImplementation(()=>new Promise(()=>{}));
  });

  afterEach(()=>{cleanup();vi.useRealTimers()});

  it('continues from the original queue time when the panel reopens',async()=>{
    const {container}=render(<VintageCheck wine={wine}/>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(300)});

    expect(container.querySelector('.vintage-elapsed')?.textContent).toBe('15s');
    expect(vi.mocked(observeVintageResearch)).toHaveBeenCalledWith('job',expect.anything());
    expect(vi.mocked(lookUpVintageWindow)).not.toHaveBeenCalled();
  });
});
