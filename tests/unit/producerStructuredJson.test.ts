import { describe,expect,it } from 'vitest';
import { firstBalancedJsonObject,hasLikelyEmbeddedJsonFragment,parseStructuredJsonText } from '../../src/lib/producers/structuredJson';

describe('producer structured JSON parsing',()=>{
  it('parses normal JSON',()=>{
    expect(parseStructuredJsonText('{"range":[{"name":"A"}]}')).toEqual({range:[{name:'A'}]});
  });

  it('recovers fenced JSON with surrounding prose',()=>{
    const text='Result follows:\n```json\n{"range":[{"name":"A","notes":"brace } inside string"}]}\n```\nDone';
    expect(parseStructuredJsonText(text)).toEqual({range:[{name:'A',notes:'brace } inside string'}]});
  });

  it('extracts the first balanced object without being confused by escaped quotes',()=>{
    const text='prefix {"profile":"A \\"quoted\\" value","range":[]} suffix';
    expect(firstBalancedJsonObject(text)).toBe('{"profile":"A \\"quoted\\" value","range":[]}');
    expect(parseStructuredJsonText(text)).toEqual({profile:'A "quoted" value',range:[]});
  });

  it('rejects truncated JSON instead of silently repairing missing structure',()=>{
    expect(()=>parseStructuredJsonText('{"range":[{"name":"A"}]')).toThrow('Invalid structured JSON');
  });

  it('detects an escaped next-record fragment swallowed into a catalogue field',()=>{
    const corrupted='Still dry white唱 notes null},{';
    expect(hasLikelyEmbeddedJsonFragment(corrupted)).toBe(true);
    const payload=JSON.stringify({range:[{name:'Affinités Chardonnay',category:'white',style:corrupted}]});
    expect(()=>parseStructuredJsonText(payload)).toThrow('Structured JSON contains an embedded record fragment');
  });

  it('clears weak leaked labels from optional catalogue fields instead of failing the whole range',()=>{
    const payload=JSON.stringify({range:[{
      name:'Clos Example Grand Cru',category:'red',appellation:'Clos Example',classification:'Grand Cru',
      style:'Still dry red; classification: "Grand Cru"',notes:'notes: null'
    }]});
    expect(parseStructuredJsonText(payload)).toEqual({range:[{
      name:'Clos Example Grand Cru',category:'red',appellation:'Clos Example',classification:'Grand Cru',style:null,notes:null
    }]});
  });

  it('still rejects weak record leakage in a catalogue identity name',()=>{
    const payload=JSON.stringify({range:[{name:'name: "Other wine"',category:'red'}]});
    expect(()=>parseStructuredJsonText(payload)).toThrow('Structured JSON contains an embedded record fragment at root.range[0].name');
  });

  it('detects leaked JSON keys without rejecting ordinary prose punctuation',()=>{
    expect(hasLikelyEmbeddedJsonFragment('Sparkling brut nature')).toBe(false);
    expect(hasLikelyEmbeddedJsonFragment('brace } inside string')).toBe(false);
    expect(hasLikelyEmbeddedJsonFragment('notes: null')).toBe(true);
    expect(()=>parseStructuredJsonText(JSON.stringify({profile:'The estate bottles without fining or filtration.'}))).not.toThrow();
  });
});
