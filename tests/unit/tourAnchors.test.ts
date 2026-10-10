import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';
import { allTours,chapters,firstRunSteps,stepsFor } from '../../src/features/onboarding/steps';

const src=join(process.cwd(),'src');
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
 const path=join(dir,entry.name);
 return entry.isDirectory()?walk(path):[path];
});
const markup=walk(src).filter(path=>path.endsWith('.tsx')).map(path=>readFileSync(path,'utf8')).join('\n');
/** Every path App.tsx routes, as an absolute path. */
const routed=new Set([...readFileSync(join(src,'App.tsx'),'utf8').matchAll(/path="([^"]+)"/g)]
 .map(match=>match[1].startsWith('/')?match[1]:`/${match[1]}`).concat('/'));
const rendered=new Set([...markup.matchAll(/data-tour="([^"]+)"/g)].map(match=>match[1]));
const everyStep=allTours.flatMap(tour=>tour.steps);

/**
 * The tour points at elements by name, from a separate file. Nothing in the
 * type system connects the two, so a nav item renamed or restyled out of
 * existence would leave a step pointing at nothing - and the overlay passes
 * over a missing anchor silently, by design, which is exactly what would keep
 * the breakage quiet. This is the check that makes it loud.
 */
describe('tour anchors',()=>{
 it('every step points at an element the app actually renders',()=>{
  const missing=everyStep.filter(step=>step.anchor&&!rendered.has(step.anchor)).map(step=>`${step.id} -> ${step.anchor}`);
  expect(missing).toEqual([]);
 });

 /**
  * The same trap one level up: a chapter takes you to a page by path, and a
  * route renamed in App.tsx would leave the chapter navigating to a blank
  * screen with no error anywhere.
  */
 it('every step that navigates names a route the app actually has',()=>{
  const unrouted=everyStep.filter(step=>step.route&&!routed.has(step.route)).map(step=>`${step.id} -> ${step.route}`);
  expect(unrouted).toEqual([]);
 });

 it('has routes to check, so that guard is not passing on an empty set',()=>{
  expect(everyStep.filter(step=>step.route).length).toBeGreaterThan(3);
 });

 /** The first run describes the chrome, which is on every page already. */
 it('never navigates during the first run',()=>{
  expect(firstRunSteps.filter(step=>step.route)).toEqual([]);
 });

 it('gives every chapter a label and a blurb for the Account list',()=>{
  for(const chapter of chapters){
   expect(chapter.label,`${chapter.id} needs a label`).toBeTruthy();
   expect(chapter.blurb,`${chapter.id} needs a blurb`).toBeTruthy();
   expect(chapter.steps.length,`${chapter.id} needs steps`).toBeGreaterThan(0);
  }
 });

 it('keeps every tour id distinct, since progress is recorded against it',()=>{
  const ids=allTours.map(tour=>tour.id);
  expect(new Set(ids).size).toBe(ids.length);
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

/**
 * The copy does not only point at elements, it names labels on other screens:
 * the In cellar tab, the four modes in the scan sheet, the allowance heading on
 * Account. A renamed label leaves the tour giving directions to something that
 * is not there - the same failure as a missing anchor, one level up, and just
 * as quiet. Caught once already: the tour said "Cellar tab" for a tab the app
 * calls "In cellar", and the account chip replaced the words "Account &
 * friends" with a circle the copy had never described.
 */
describe('labels the copy sends people to',()=>{
 const copy=[readFileSync(join(src,'features','onboarding','steps.ts'),'utf8'),
             readFileSync(join(src,'features','auth','CreditConfirmation.tsx'),'utf8')].join('\n');
 const labels=[
  {phrase:'In cellar',file:join('features','wines','JournalScopeTabs.tsx')},
  {phrase:'Single Wine',file:join('components','Layout.tsx')},
  {phrase:'Group Photo',file:join('components','Layout.tsx')},
  {phrase:'Batch Scan',file:join('components','Layout.tsx')},
  {phrase:'Start Tasting',file:join('components','Layout.tsx')},
  {phrase:'This week\u2019s AI allowance',file:join('features','auth','AccountPage.tsx')},
  {phrase:'Tasted',file:join('features','wines','JournalScopeTabs.tsx')},
  {phrase:'Smart search',file:join('features','wines','JournalSearchInput.tsx')},
  {phrase:'Clear filters',file:join('features','wines','LibraryPage.tsx')},
  {phrase:'years at a glance',file:join('features','vintages','VintagesPage.tsx')},
  {phrase:'Warmth',file:join('features','vintages','VintagesPage.tsx')},
  {phrase:'How unusual',file:join('features','vintages','VintagesPage.tsx')},
  {phrase:'Compare with',file:join('features','vintages','VintageParts.tsx')}
 ];

 it.each(labels)('$phrase is still what $file calls it',({phrase,file})=>{
  expect(readFileSync(join(src,file),'utf8'),`${phrase} is no longer in ${file}`).toContain(phrase);
 });

 /**
  * Case-insensitive on this half only. A step title legitimately capitalises a
  * phrase the screen writes in a sentence - "Years at a glance" over the app's
  * "{n} years at a glance" - and that is not drift. The check above stays
  * exact, so a real rename is still caught.
  */
 it('and every one of them is actually quoted by the tour, so the list cannot go stale',()=>{
  const quoted=copy.toLowerCase();
  const unused=labels.filter(label=>!quoted.includes(label.phrase.toLowerCase())).map(label=>label.phrase);
  expect(unused).toEqual([]);
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
