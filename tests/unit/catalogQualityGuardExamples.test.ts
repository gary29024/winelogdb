import { describe,expect,it } from 'vitest';
import { catalogTextQualityIssue } from '../../src/lib/producers/researchQuality';

describe('catalog quality guard examples',()=>{
  it('catches the repeated-character style corruption seen in producer research',()=>{
    expect(catalogTextQualityIssue('Sparkling brut natureOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO','style',80)).toContain('repeated-character');
  });

  it('keeps normal Burgundy and Champagne catalogue text',()=>{
    expect(catalogTextQualityIssue("Corton-Charlemagne Grand Cru Les Languettes",'name',220)).toBeNull();
    expect(catalogTextQualityIssue('Sparkling brut nature','style',80)).toBeNull();
  });
});
