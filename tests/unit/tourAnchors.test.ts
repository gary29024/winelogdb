import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';
import { firstRunSteps,stepsFor } from '../../src/features/onboarding/steps';

const src=join(process.cwd(),'src');
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
 const path=join(dir,entry.name);
 return entry.isDirectory()?walk(path):[path];
});
const markup=walk(src).filter(path=>path.endsWith('.tsx')).map(path=>readFileSync(path,'utf8')).join('\n');
const rendered=new Set([...markup.matchAll(/data-tour="([^"]+)"/g)].map(match=>match[1]));

/**
 * The tour points at elements by name, from a separate file. Nothing in the
 * type system connects the two, so a nav item renamed or restyled out of
 * existence would leave a step pointing at nothing - and the overlay passes
 * over a missing anchor silently, by design, which is exactly what would keep
 * the breakage quiet. This is the check that makes it loud.
 */
describe('tour anchors',()=>{
 it('every step points at an element the app actually renders',()=>{
  const missing=firstRunSteps.filter(step=>step.anchor&&!rendered.has(step.anchor)).map(step=>`${step.id} -> ${step.anchor}`);
  expect(missing).toEqual([]);
 });

 it('has anchors to check, so the guard is not passing on an empty set',()=>{
  expect(firstRunSteps.filter(step=>step.anchor).length).toBeGreaterThan(3);
  expect(rendered.size).toBeGreaterThan(3);
 });

 /**
  * Passport, Journal and Producers sit in both navs under one anchor name, and
  * the engine spotlights whichever copy has a real box. That only works while
  * the pair stays a pair: if one side loses the attribute, the phone or the
  * desktop silently skips the step.
  */
 it('keeps the shared nav anchors on both the top bar and the tab bar',()=>{
  const layout=readFileSync(join(src,'components','Layout.tsx'),'utf8');
  const occurrences=(anchor:string)=>[...layout.matchAll(new RegExp(`data-tour="${anchor}"`,'g'))].length;
  for(const anchor of ['nav-passport','nav-journal','nav-producers','scan-trigger'])
   expect(occurrences(anchor),`${anchor} should appear in both navs`).toBe(2);
 });
});

describe('who sees which step',()=>{
 it('gives the phone no Tastings step, because the tab bar has no Tastings slot',()=>{
  const ids=stepsFor(firstRunSteps,'member',true).map(step=>step.id);
  expect(ids).not.toContain('nav-tastings');
  // The subject is not dropped, only moved: the scan sheet carries Start Tasting.
  expect(ids).toContain('scan');
 });

 it('gives the desktop its Tastings step, since the top bar carries the link',()=>{
  expect(stepsFor(firstRunSteps,'member',false).map(step=>step.id)).toContain('nav-tastings');
 });

 it('shows the owner and a member the same first run, there being no credit step yet',()=>{
  expect(stepsFor(firstRunSteps,'owner',false)).toEqual(stepsFor(firstRunSteps,'member',false));
 });

 it('filters by role when a step asks for one',()=>{
  const steps=[{id:'credits',title:'Credits',body:'Members only.',roles:['member'] as Array<'owner'|'member'>}];
  expect(stepsFor(steps,'member',false)).toHaveLength(1);
  expect(stepsFor(steps,'owner',false)).toHaveLength(0);
 });

 it('ends on the closing card for everyone',()=>{
  for(const mobile of [true,false])
   expect(stepsFor(firstRunSteps,'member',mobile).at(-1)?.id).toBe('tour-done');
 });
});
