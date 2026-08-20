import { describe,expect,it } from 'vitest';
import { hasLikelyEmbeddedJsonFragment } from '../../src/lib/producers/structuredJson';

describe('producer catalog corruption signatures',()=>{
  it('recognizes the observed swallowed-record pattern without flagging normal wine metadata',()=>{
    expect(hasLikelyEmbeddedJsonFragment('Still dry white唱 notes null},{')).toBe(true);
    expect(hasLikelyEmbeddedJsonFragment('Still dry white')).toBe(false);
    expect(hasLikelyEmbeddedJsonFragment('Willamette Valley')).toBe(false);
    expect(hasLikelyEmbeddedJsonFragment('Current release; sourced from a single vineyard.')).toBe(false);
  });
});
