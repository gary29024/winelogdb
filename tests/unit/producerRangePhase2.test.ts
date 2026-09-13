import { describe,expect,it } from 'vitest';
import { directRangeProviders,extractRangeLinks,normalizeDirectRangeResult,profileFreshForDirectRange,zaiGatewayChatCompletionsUrl,zaiGatewayHeaders } from '../../src/lib/producers/catalogDirectResearch';

const gateway={CF_AI_GATEWAY_TOKEN:'cf-token',AI_GATEWAY_ACCOUNT_ID:'account-123',AI_GATEWAY_ID:'winelog'};

describe('producer range Phase 2 routing',()=>{
 it('uses Z.AI through AI Gateway as the only cheap range provider',()=>{
  expect(directRangeProviders(gateway)).toEqual(['zai-gateway']);
  expect(directRangeProviders({AI_GATEWAY_ACCOUNT_ID:'account-123',AI_GATEWAY_ID:'winelog'})).toEqual([]);
  expect(directRangeProviders({})).toEqual([]);
 });

 it('routes Z.AI to the custom provider without carrying a provider API key',()=>{
  expect(zaiGatewayChatCompletionsUrl(gateway)).toBe('https://gateway.ai.cloudflare.com/v1/account-123/winelog/custom-zai/api/paas/v4/chat/completions');
  const headers=zaiGatewayHeaders(gateway);
  expect(headers.get('cf-aig-authorization')).toBe('Bearer cf-token');
  expect(headers.get('authorization')).toBeNull();
  expect(headers.get('cf-aig-collect-log-payload')).toBe('false');
  expect(headers.get('cf-aig-metadata')).toContain('producer-range');
 });

 it('honours the configured custom-provider slug and explicit payload logging',()=>{
  const env={...gateway,ZAI_GATEWAY_PROVIDER_SLUG:'z-ai',AI_GATEWAY_LOG_PAYLOADS:'true'};
  expect(zaiGatewayChatCompletionsUrl(env)).toContain('/custom-z-ai/api/paas/v4/chat/completions');
  expect(zaiGatewayHeaders(env).get('cf-aig-collect-log-payload')).toBe('true');
 });

 it('requires the already-saved profile to still be fresh',()=>{
  const now=Date.parse('2026-09-12T00:00:00Z');
  expect(profileFreshForDirectRange({profile:'Estate profile',home_country:'France',profile_researched_at:'2026-09-01T00:00:00Z'},now)).toBe(true);
  expect(profileFreshForDirectRange({profile:'Estate profile',home_country:'',profile_researched_at:'2026-09-01T00:00:00Z'},now)).toBe(false);
  expect(profileFreshForDirectRange({profile:'Estate profile',home_country:'France',profile_researched_at:'2020-01-01T00:00:00Z'},now)).toBe(false);
 });

 it('discovers only same-site wine/range links from official HTML',()=>{
  const html=`<a href="/our-wines">Our wines</a><a href="https://domaine.example/vins/clos-a">Clos A</a><a href="/contact">Contact</a><a href="https://merchant.example/wines">Shop wines</a>`;
  expect(extractRangeLinks(html,'https://domaine.example/')).toEqual(['https://domaine.example/our-wines','https://domaine.example/vins/clos-a']);
 });

 it('deduplicates cheap-model output and refuses invented source URLs',()=>{
  const source='https://domaine.example/wines';
  const result=normalizeDirectRangeResult({rangeComplete:true,coverageNote:'Complete official range',range:[
    {name:'Domaine Test Clos A',category:'red',appellation:'Bourgogne',sourceUrl:source},
    {name:'Clos A',category:'red',appellation:'Bourgogne',sourceUrl:'https://merchant.example/a'},
    {name:'Clos B',category:'white',sourceUrl:source}
  ]},['Domaine Test'],new Set([source]));
  expect(result.rangeComplete).toBe(true);expect(result.range).toHaveLength(2);
  expect(result.range[0].sourceUrl).toBe(source);
  expect(result.range.every(item=>item.sourceUrl===source||item.sourceUrl==null)).toBe(true);
 });
});
