// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { ScanBeam,ScanProgress } from '../../src/components/ScanProgress';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

let root:Root|null=null,host:HTMLDivElement|null=null;
const steps=['Reading the label…','Finding the producer…','Checking the vintage…'] as const;

function render(node:React.ReactNode){
  act(()=>root!.render(node));
}
const value=()=>Number(host!.querySelector('[role=progressbar]')!.getAttribute('aria-valuenow'));
const message=()=>host!.querySelector('.scan-progress-step')!.textContent;
const clock=()=>host!.querySelector('.scan-progress-clock')?.textContent;
const advance=(ms:number)=>act(()=>{vi.advanceTimersByTime(ms)});

beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-09T12:00:00Z'));
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
});
afterEach(()=>{
  act(()=>root?.unmount());host?.remove();root=null;host=null;vi.useRealTimers();
});

describe('scan progress',()=>{
  it('holds still while the request waits on a credit confirmation',()=>{
    render(<ScanProgress startedAt={null} steps={steps} slowStep="Still reading…" label="Identifying"/>);
    const before=value();
    advance(10_000);
    expect(value()).toBe(before);
    expect(message()).toBe('Getting ready…');
    expect(clock()).toBeUndefined();
  });

  it('keeps creeping forward without ever claiming to be done',()=>{
    render(<ScanProgress startedAt={Date.now()} steps={steps} slowStep="Still reading…" label="Identifying"/>);
    const seen=[value()];
    for(let i=0;i<12;i++){advance(5_000);seen.push(value())}
    for(let i=1;i<seen.length;i++)expect(seen[i]).toBeGreaterThanOrEqual(seen[i-1]);
    expect(seen[2]).toBeGreaterThan(seen[0]);
    expect(seen.at(-1)).toBeLessThan(100);
  });

  it('says what it is reading, holds the last step, then admits a long wait',()=>{
    render(<ScanProgress startedAt={Date.now()} steps={steps} slowStep="Still reading…" label="Identifying"/>);
    expect(message()).toBe('Reading the label…');
    advance(4_000);
    expect(message()).toBe('Finding the producer…');
    advance(20_000);
    expect(message()).toBe('Checking the vintage…');
    advance(7_000);
    expect(message()).toBe('Still reading…');
    expect(clock()).toBe('31s');
  });

  it('lets the caller name the work left once the answer is in',()=>{
    render(<ScanProgress startedAt={Date.now()} steps={steps} step="Cropping each bottle…" slowStep="Still reading…" label="Identifying"/>);
    expect(message()).toBe('Cropping each bottle…');
  });

  it('keeps the sweep out of the accessibility tree',()=>{
    render(<ScanBeam delay={0.45}/>);
    const beam=host!.querySelector('.scan-beam') as HTMLElement;
    expect(beam.getAttribute('aria-hidden')).toBe('true');
    expect(beam.style.getPropertyValue('--scan-delay')).toBe('0.45s');
  });
});
