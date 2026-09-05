import { describe,expect,it,vi } from 'vitest';
import { runOneShotMaintenance } from '../../src/lib/db/oneShotMaintenance';
import { createD1Stub } from './support/d1Stub';

describe('one-shot maintenance claim cost',()=>{
  it('shares concurrent checks and skips repeat D1 claims in a warm Worker',async()=>{
    const stub=createD1Stub(()=>({changes:0})),work=vi.fn();
    const first=runOneShotMaintenance(stub.db,'owner','repair',work);
    expect(runOneShotMaintenance(stub.db,'owner','repair',work)).toBe(first);
    await first;await runOneShotMaintenance(stub.db,'owner','repair',work);
    expect(stub.calls).toHaveLength(1);expect(work).not.toHaveBeenCalled();
  });

  it.each(['capped','failed'])('releases and retries a %s pass',async outcome=>{
    const stub=createD1Stub(),work=vi.fn().mockResolvedValue({capped:true});
    if(outcome==='failed')work.mockRejectedValueOnce(new Error('interrupted'));
    await runOneShotMaintenance(stub.db,'owner','repair',work).catch(()=>undefined);
    expect(stub.matching(/^DELETE/)).toHaveLength(1);
    work.mockResolvedValue({capped:false});
    await runOneShotMaintenance(stub.db,'owner','repair',work);
    await runOneShotMaintenance(stub.db,'owner','repair',work);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('isolates claims by database and owner',async()=>{
    const a=createD1Stub(()=>({changes:0})),b=createD1Stub(()=>({changes:0})),work=vi.fn();
    await runOneShotMaintenance(a.db,'a','repair',work);
    await runOneShotMaintenance(a.db,'b','repair',work);
    await runOneShotMaintenance(b.db,'a','repair',work);
    expect(a.calls).toHaveLength(2);expect(b.calls).toHaveLength(1);
  });

  it('rechecks a claim held by another isolate after the memo expires',async()=>{
    const clock=vi.spyOn(Date,'now').mockReturnValue(1000);
    try{
      const stub=createD1Stub(()=>({changes:0})),work=vi.fn();
      await runOneShotMaintenance(stub.db,'owner','repair',work);
      clock.mockReturnValue(61_001);
      await runOneShotMaintenance(stub.db,'owner','repair',work);
      expect(stub.calls).toHaveLength(2);
    }finally{clock.mockRestore()}
  });
});
