import { describe,expect,it } from 'vitest';
import { collectLogPayload } from '../../worker/geminiTransport';

describe('AI Gateway payload logging',()=>{
  it('stays off unless it is asked for',()=>{
    // The header overrides the gateway's own setting, so an unset var must mean
    // off rather than "whatever the dashboard says".
    expect(collectLogPayload({})).toBe(false);
    expect(collectLogPayload({AI_GATEWAY_LOG_PAYLOADS:''})).toBe(false);
    expect(collectLogPayload({AI_GATEWAY_LOG_PAYLOADS:'false'})).toBe(false);
    expect(collectLogPayload({AI_GATEWAY_LOG_PAYLOADS:'0'})).toBe(false);
    expect(collectLogPayload({AI_GATEWAY_LOG_PAYLOADS:'yes'})).toBe(false);
  });

  it('turns on for the spellings a var is realistically set to',()=>{
    expect(collectLogPayload({AI_GATEWAY_LOG_PAYLOADS:'true'})).toBe(true);
    expect(collectLogPayload({AI_GATEWAY_LOG_PAYLOADS:'TRUE'})).toBe(true);
    expect(collectLogPayload({AI_GATEWAY_LOG_PAYLOADS:' true '})).toBe(true);
  });
});
