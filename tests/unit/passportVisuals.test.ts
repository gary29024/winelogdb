import { describe,expect,it } from 'vitest';
import { grapeColorFor,normalizeGrapeName,styleColorKeyFor } from '../../src/features/journey/passportVisuals';

describe('Passport grape colors',()=>{
  it('uses grape identity rather than ranking for Chardonnay and Pinot Noir',()=>{
    expect(grapeColorFor('Chardonnay')).toBe('#e1bd45');
    expect(grapeColorFor('Pinot Noir')).toBe('#a8172d');
  });

  it('normalizes accents/case and keeps fallback colors stable',()=>{
    expect(normalizeGrapeName(' Grüner Veltliner ')).toBe('gruner veltliner');
    expect(grapeColorFor('Grüner Veltliner')).toBe('#87a04e');
    expect(grapeColorFor('Unknown Grape')).toBe(grapeColorFor('unknown grape'));
  });
});

describe('Insights style colors',()=>{
  it('gives each common wine style a semantic chart color',()=>{
    const colors=['red','white','sparkling','dessert','rose','orange','fortified','other'].map(styleColorKeyFor);
    expect(new Set(colors).size).toBe(colors.length);
    expect(styleColorKeyFor('Red')).toBe('red');
    expect(styleColorKeyFor('unknown')).toBe('other');
  });
});
