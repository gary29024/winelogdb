import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';
import { elapsedSeconds } from '../../src/components/ElapsedSeconds';

const source=(path:string)=>readFileSync(resolve(path),'utf8');

describe('research elapsed clocks',()=>{
 it('computes a stable non-negative elapsed second count',()=>{
  const started='2026-09-01T00:00:00.000Z';
  expect(elapsedSeconds(started,Date.parse('2026-09-01T00:00:05.900Z'))).toBe(5);
  expect(elapsedSeconds(started,Date.parse('2026-08-31T23:59:59.000Z'))).toBe(0);
  expect(elapsedSeconds('not-a-date',Date.parse('2026-09-01T00:00:05.900Z'))).toBe(0);
 });

 it('keeps the one-second timer out of the wine and producer detail page trees',()=>{
  const wine=source('src/features/wines/DetailPage.tsx');
  const producer=source('src/features/producers/ProducerDetailPage.tsx');

  expect(wine).toContain('<ElapsedSeconds startedAt={deepRun.startedAt}/>');
  expect(producer).toContain('<ElapsedSeconds startedAt={researchRun.startedAt}/>');
  expect(wine).not.toMatch(/deepElapsed|clockRef|setInterval/);
  expect(producer).not.toMatch(/researchElapsed|researchClock|setInterval/);
 });
});
