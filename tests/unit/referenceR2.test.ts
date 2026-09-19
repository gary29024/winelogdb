import { describe,expect,it } from 'vitest';
import { wranglerInvocation } from '../../scripts/referenceR2';

describe('reference data Wrangler launcher',()=>{
 it('invokes Wrangler through Node instead of a platform-specific shell shim',()=>{
  const args=['r2','object','put','bucket/key','--remote'];
  const invocation=wranglerInvocation(args);
  expect(invocation.command).toBe(process.execPath);
  expect(invocation.cli.replace(/\\/g,'/')).toMatch(/\/node_modules\/wrangler\/bin\/wrangler\.js$/);
  expect(invocation.args).toEqual([invocation.cli,...args]);
 });
});
