import { describe,expect,it } from 'vitest';
import { outlookNote } from '../../src/features/vintages/model';
import type { OutlookCheck } from '../../src/features/vintages/types';

const check=(error:number,errorIfAverage:number):OutlookCheck=>({years:30,correlation:0.5,error,errorIfAverage,withinOneStep:0.9,spread:0.5});

describe('quality outlook note',()=>{
  it('compares the held-out error with guessing the era average',()=>{
    const note=outlookNote(check(0.7,1.11),false,1991);
    expect(note).toContain('before 1991');
    expect(note).toContain('0.70');
    expect(note).toContain('1.11 for guessing');
    expect(note).not.toContain('little better');
  });
  it('says plainly when the weather barely beats the average guess',()=>{
    const note=outlookNote(check(0.41,0.45),true,1991);
    expect(note).toContain('since 1991');
    expect(note).toContain('little better than guessing');
    expect(note).toContain('0.45');
  });
});
