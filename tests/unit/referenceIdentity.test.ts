import { describe,expect,it } from 'vitest';
import { isValidElid,normalizeLwinId,normalizeReferenceText,normalizedVintageKind,vintageReferenceCode } from '../../src/lib/wine/referenceIdentity';

describe('external wine identity helpers',()=>{
 it('normalizes LWIN values read as Excel numbers',()=>{
  expect(normalizeLwinId('1000131.0')).toBe('1000131');
  expect(normalizeLwinId('NA')).toBeNull();
  expect(normalizeLwinId('123')).toBeNull();
 });
 it('normalizes names without destroying non-Latin identity',()=>{
  expect(normalizeReferenceText('Domaine d’Auvenay')).toBe('domaine dauvenay');
  expect(normalizeReferenceText('勝沼醸造')).toBe('勝沼醸造');
 });
 it('validates ELID syntax but does not generate an identifier',()=>{
  expect(isValidElid('FR-CMP-KRUG01-N171')).toBe(true);
  expect(isValidElid('FR-BGN-DUJA01-2019')).toBe(true);
  expect(isValidElid('FR-BGN-made-up-2019')).toBe(false);
 });
 it('does not confuse an unknown vintage with non-vintage',()=>{
  expect(normalizedVintageKind(null,null)).toBe('unknown');
  expect(normalizedVintageKind(null,'non_vintage')).toBe('non_vintage');
  expect(vintageReferenceCode(2019,'vintage')).toBe('2019');
  expect(vintageReferenceCode(null,'non_vintage')).toBe('');
 });
});
