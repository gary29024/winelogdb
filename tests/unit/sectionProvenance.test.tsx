// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup,render,screen } from '@testing-library/react';
import { afterEach,describe,expect,it } from 'vitest';
import { SectionLabel } from '../../src/components/SectionLabel';

afterEach(()=>cleanup());

const provenanceCss=readFileSync('src/sectionProvenance.css','utf8');
const styles=readFileSync('src/styles.css','utf8');

describe('the provenance badge',()=>{
  it('says nothing at all for a derived section',()=>{
    // Derived is the default and therefore silent. A badge on every section
    // marks nothing - which is what happened to the tracked-uppercase
    // treatment before section labels became sentence case.
    const {container}=render(<SectionLabel>Wine details</SectionLabel>);
    expect(container.querySelector('.provenance-chip')).toBeNull();
    expect(screen.getByText('Wine details')).not.toBeNull();
  });

  it('names each rank it does mark, in words and not by colour',()=>{
    for(const [origin,label] of [['yours','Yours'],['researched','Researched']] as const){
      const {container}=render(<SectionLabel origin={origin}>Section</SectionLabel>);
      const chip=container.querySelector('.provenance-chip')!;
      expect(chip,`${origin} should render a badge`).not.toBeNull();
      expect(chip.textContent).toContain(label);
      expect(chip.getAttribute('data-origin')).toBe(origin);
      cleanup();
    }
  });

  it('explains what the rank means rather than leaving a bare word',()=>{
    const {container}=render(<SectionLabel origin="researched">Deep Search</SectionLabel>);
    expect(container.querySelector('.provenance-chip')!.getAttribute('title')).toMatch(/cited sources/i);
  });

  it('draws each badge from the shared chip primitive rather than a tenth shape',()=>{
    const {container}=render(<SectionLabel origin="yours">Your experience</SectionLabel>);
    expect(container.querySelector('.provenance-chip')!.classList.contains('chip')).toBe(true);
    const primitive=/\.chip,[^{]*\{/.exec(styles)?.[0]??'';
    expect(primitive,'the chip primitive should claim .provenance-chip').toContain('.provenance-chip');
  });

  it('hands the hairline to the words so the badge keeps the margin',()=>{
    // A plain section label carries its rule on ::after, which with a badge on
    // the row would sit between the words and the badge instead of pushing the
    // badge out to the edge.
    expect(provenanceCss).toMatch(/\.section-label:has\(\.provenance-chip\)::after\{[^}]*display:none/);
    expect(provenanceCss).toMatch(/\.section-label:has\(\.provenance-chip\) \.section-label-text::after\{[^}]*flex:1/);
  });

  it('keeps the icon out of the accessibility tree, since the word is already there',()=>{
    const {container}=render(<SectionLabel origin="researched">Research</SectionLabel>);
    expect(container.querySelector('.provenance-icon')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('still lets a section put something else on the row',()=>{
    const {container}=render(<SectionLabel origin="researched" trailing={<span className="deep-quality-pill">82/100</span>}>Research</SectionLabel>);
    expect(container.querySelector('.deep-quality-pill')).not.toBeNull();
  });
});
