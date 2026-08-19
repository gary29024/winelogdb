import { describe,expect,it } from 'vitest';
import { firstBalancedJsonObject,parseStructuredJsonText } from '../../src/lib/producers/structuredJson';

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
});
