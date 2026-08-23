import { describe,expect,it } from 'vitest';
import type { DeepSearchProvenance } from '../../src/lib/db/schema';
import { summarizeFieldProvenance,type ResearchClaimProvenance } from '../../src/lib/research/provenance';
import { auditTechnicalContradictions,technicalContradictionFailureMessage,technicalContradictionScopePasses } from '../../src/lib/research/technicalContradictions';

function supported(claim:string,url:string,title='Source'):ResearchClaimProvenance{return {claim,supportStatus:'supported',sourceTier:'grounded',sources:[{title,url}]}}
function provenance(claims:ResearchClaimProvenance[]):DeepSearchProvenance{return {version:1,fields:{winemakingTechniques:summarizeFieldProvenance(claims)}}}
function payload(winemakingTechniques:string){return {summary:'Exact wine summary.',winemakingTechniques,drinkingWindow:'Drink 2028–2040.'}}

describe('cross-source technical contradiction audit',()=>{
  it('rejects independently grounded conflicting new-oak figures when the research silently chooses neither explanation nor disclosure',()=>{
    const a='Source A reports 30% new oak.',b='Source B reports 50% new oak.',p=provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')]),data=payload(`${a}\n${b}`),audit=auditTechnicalContradictions(data,p);
    expect(audit.conflicts).toHaveLength(1);
    expect(audit.conflicts[0].metric).toBe('new_oak_percentage');
    expect(audit.unacknowledged).toHaveLength(1);
    expect(technicalContradictionScopePasses('wine_vintage',data,p)).toBe(false);
    expect(technicalContradictionFailureMessage(data,p)).toMatch(/unresolved technical disagreement/);
  });

  it('preserves both directly grounded figures as disputed when the report explicitly discloses the source conflict',()=>{
    const a='Source A reports 30% new oak.',b='Source B reports 50% new oak.',data=payload(`${a}\n${b}\nSources conflict on the exact new-oak percentage.`),audit=auditTechnicalContradictions(data,provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')])),field=audit.provenance?.fields.winemakingTechniques;
    expect(audit.unacknowledged).toEqual([]);
    expect(field?.conflictingCount).toBe(2);
    expect(field?.supportedCount).toBe(0);
    expect(field?.claims.map(item=>item.supportStatus)).toEqual(['conflicting','conflicting']);
    expect(field?.directSupportRatio).toBe(1);
    expect(technicalContradictionScopePasses('wine_vintage',data,audit.provenance)).toBe(true);
  });

  it('recognizes written percent wording as the same technical metric',()=>{
    const a='Source A reports 30 percent new oak.',b='Source B reports 50 per cent new oak.',audit=auditTechnicalContradictions(payload(`${a}\n${b}`),provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')]));
    expect(audit.conflicts).toHaveLength(1);
    expect(audit.conflicts[0].metric).toBe('new_oak_percentage');
  });

  it('does not invent a contradiction when independent sources agree on the same value',()=>{
    const a='Source A reports 30% new oak.',b='Source B also reports 30% new oak.',audit=auditTechnicalContradictions(payload(`${a}\n${b}`),provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')]));
    expect(audit.conflicts).toEqual([]);
  });

  it('requires source independence before calling two values a cross-source conflict',()=>{
    const a='The producer page lists 30% new oak.',b='The same producer page elsewhere lists 50% new oak.',audit=auditTechnicalContradictions(payload(`${a}\n${b}`),provenance([supported(a,'https://producer.example/wine'),supported(b,'https://producer.example/wine')]));
    expect(audit.conflicts).toEqual([]);
  });

  it('normalizes equivalent duration wording instead of flagging 18 months versus 1.5 years',()=>{
    const a='The wine was matured for 18 months in barrel.',b='The wine was aged for 1.5 years in oak.',audit=auditTechnicalContradictions(payload(`${a}\n${b}`),provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')]));
    expect(audit.conflicts).toEqual([]);
  });

  it('detects a disclosed dosage disagreement without forcing one dosage into the final answer',()=>{
    const a='Source A states a dosage of 5 g/L.',b='Source B states a dosage of 6 g/L.',data=payload(`${a}\n${b}\nReliable sources differ on dosage, possibly because of different disgorgements.`),audit=auditTechnicalContradictions(data,provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')]));
    expect(audit.conflicts).toHaveLength(1);
    expect(audit.conflicts[0].metric).toBe('dosage_g_l');
    expect(audit.unacknowledged).toEqual([]);
    expect(audit.provenance?.fields.winemakingTechniques?.conflictingCount).toBe(2);
  });

  it('does not compare unrelated percentages as though they describe the same technical fact',()=>{
    const a='The wine used 30% new oak.',b='The wine used 50% whole bunches.',audit=auditTechnicalContradictions(payload(`${a}\n${b}`),provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')]));
    expect(audit.conflicts).toEqual([]);
  });
});
