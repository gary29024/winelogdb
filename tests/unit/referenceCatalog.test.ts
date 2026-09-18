import { describe,expect,it } from 'vitest';
import { referenceShardId } from '../../src/lib/wine/referenceCatalog';
describe('reference catalogue sharding',()=>{
 it('is deterministic and bounded',()=>{
  expect(referenceShardId('krug')).toBe(referenceShardId('krug'));
  expect(Number(referenceShardId('krug'))).toBeGreaterThanOrEqual(0);
  expect(Number(referenceShardId('krug'))).toBeLessThan(256);
 });
 it('uses different producer keys without relying on user identity',()=>expect(referenceShardId('krug')).not.toBe(referenceShardId('domaine dujac')));
});
