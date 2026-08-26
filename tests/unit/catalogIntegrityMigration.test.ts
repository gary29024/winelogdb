import { describe,expect,it } from 'vitest';
import { hasLikelyEmbeddedJsonFragment } from '../../src/lib/producers/structuredJson';

describe('producer catalog corruption signatures',()=>{
  it('recognizes the observed swallowed-record pattern without flagging normal wine metadata',()=>{
    expect(hasLikelyEmbeddedJsonFragment('Still dry white唱 notes null},{')).toBe(true);
    expect(hasLikelyEmbeddedJsonFragment('notes: null')).toBe(true);
    expect(hasLikelyEmbeddedJsonFragment('Still dry white')).toBe(false);
    expect(hasLikelyEmbeddedJsonFragment('Willamette Valley')).toBe(false);
    expect(hasLikelyEmbeddedJsonFragment('Current release; sourced from a single vineyard.')).toBe(false);
  });

  it('recognizes a field path left dangling with no value behind it',()=>{
    // Reported from the catalogue: "Still dry white唱.notes". The same
    // swallowed-record glitch, but the model stopped before writing anything
    // after the key, so there is no colon or literal for the other rules to
    // catch - only a key name hanging off a full stop.
    expect(hasLikelyEmbeddedJsonFragment('Still dry white唱.notes')).toBe(true);
    expect(hasLikelyEmbeddedJsonFragment('Still dry white.notes')).toBe(true);
    expect(hasLikelyEmbeddedJsonFragment('Sparkling rose .style')).toBe(true);
  });

  it('leaves prose that happens to end in one of those words alone',()=>{
    // The words are ordinary English, so the rule only fires on the shape of a
    // path - a full stop, then the key, then nothing.
    expect(hasLikelyEmbeddedJsonFragment('Made in a reductive style')).toBe(false);
    expect(hasLikelyEmbeddedJsonFragment('See the estate notes')).toBe(false);
    expect(hasLikelyEmbeddedJsonFragment('Aged in oak. Notes of citrus and chalk.')).toBe(false);
  });
});
