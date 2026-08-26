import { describe,expect,it } from 'vitest';
import { catalogNote } from '../../src/lib/producers/catalogNote';

describe('the line under a catalogue row',()=>{
  it('hides a note carrying the swallowed-record signature',()=>{
    // Reported from the catalogue: a Meursault row reading "Still dry white唱
    // .notes". The parser refuses to store that shape now, but rows researched
    // before it learned the signature are already in D1 and nothing re-runs
    // research for 566 producers, so the row is filtered on the way out.
    expect(catalogNote('Still dry white唱.notes',null)).toEqual({short:'',full:''});
    expect(catalogNote(null,'Still dry white唱.notes')).toEqual({short:'',full:''});
    expect(catalogNote('notes: null',null)).toEqual({short:'',full:''});
  });

  it('keeps a real note',()=>{
    expect(catalogNote('Single vineyard; whole-bunch fermented.',null))
      .toEqual({short:'Single vineyard; whole-bunch fermented.',full:'Single vineyard; whole-bunch fermented.'});
  });

  it('promotes a style only when the model wrote a sentence rather than a label',()=>{
    // A short label is already shown in the row's meta line, so repeating it
    // underneath says nothing.
    expect(catalogNote(null,'White')).toEqual({short:'',full:''});
    expect(catalogNote(null,'Still dry white with citrus and chalk, aged in barrel.').short)
      .toBe('Still dry white with citrus and chalk, aged in barrel.');
  });

  it('clips a long note at a word boundary',()=>{
    const long=`${'Chardonnay '.repeat(30)}end`;
    const note=catalogNote(long,null);
    expect(note.full).toBe(long);
    expect(note.short.endsWith('…')).toBe(true);
    expect(note.short.length).toBeLessThanOrEqual(181);
    expect(note.short).not.toContain('Chardonna…');
  });
});
