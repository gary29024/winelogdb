import { describe,expect,it } from 'vitest';
import { deepSearchProvenanceSchema,deepSearchSchema,type DeepSearchProvenance } from '../../src/lib/db/schema';
import { summarizeFieldProvenance,type ResearchClaimProvenance } from '../../src/lib/research/provenance';
import { auditTechnicalContradictions,discloseTechnicalContradictions,technicalContradictionFailureMessage,technicalContradictionScopePasses } from '../../src/lib/research/technicalContradictions';
import { highRiskTechnicalScopePasses } from '../../src/lib/research/technicalClaimGate';

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

  it('associates the reported 9 versus 10 months with lees ageing after fermentation',()=>{
    const a='Fermented in stainless steel and aged on fine lees for 9 months.',b='Following fermentation, the wine matured on lees for 10 months.';
    const audit=auditTechnicalContradictions(payload(`${a}\n${b}`),provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')]));
    expect(audit.conflicts.map(item=>item.metric)).toEqual(['lees_duration']);
    expect(audit.conflicts[0].observations.map(item=>item.displayValue)).toEqual(['9 months','10 months']);
  });

  it('compares each production stage separately when claims contain multiple durations',()=>{
    const a='Fermented for 2 weeks then aged on lees for 9 months.',b='Fermentation lasted 14 days, followed by maturation on lees for 10 months.';
    const audit=auditTechnicalContradictions(payload(`${a}\n${b}`),provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')]));
    expect(audit.conflicts.map(item=>item.metric)).toEqual(['lees_duration']);
  });

  it('does not compare bottle maturation with lees ageing because fermentation is mentioned',()=>{
    const a='Fermented in steel and aged on lees for 9 months.',b='After fermentation, the wine rested in bottle for 10 months.';
    expect(auditTechnicalContradictions(payload(`${a}\n${b}`),provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')])).conflicts).toEqual([]);
  });

  it.each([
    ['Fermentation lasted 20 days.','The must fermented for 40 days.','fermentation_duration'],
    ['Macerated for 20 days before fermentation.','Maceration lasted 40 days.','maceration_duration'],
    ['Aged for 12 months in oak.','Matured in barrel for 18 months.','barrel_maturation_duration'],
    ['Bottle aged for 12 months.','Matured for 18 months in bottle.','bottle_maturation_duration'],
    ['Spent 9 months on lees.','Spent 10 months on fine lees.','lees_duration']
  ])('keeps durations bound to their named process: %s', (a,b,metric)=>{
    const audit=auditTechnicalContradictions(payload(`${a}\n${b}`),provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')]));
    expect(audit.conflicts.map(item=>item.metric)).toEqual([metric]);
  });

  it('does not treat disclosure of one metric as disclosure of a different conflict',()=>{
    const claims=[supported('Source A reports 30% new oak.','https://a.example/tech'),supported('Source B reports 50% new oak.','https://b.example/tech'),supported('Source C reports a dosage of 5 g/L.','https://c.example/tech'),supported('Source D reports a dosage of 6 g/L.','https://d.example/tech')];
    const audit=auditTechnicalContradictions(payload(`${claims.map(item=>item.claim).join('\n')}\nSources conflict on the new-oak percentage.`),provenance(claims));
    expect(audit.unacknowledged.map(item=>item.metric)).toEqual(['dosage_g_l']);
  });
});

describe('technical disagreement disclosure',()=>{
  it('keeps both grounded claims and their sources, and completes with an explicit dispute',()=>{
    const a='Fermented in stainless steel and aged on fine lees for 9 months.',b='Following fermentation, the wine matured on lees for 10 months.';
    const data=payload(`${a}\n${b}`),p=provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')]);
    const result=discloseTechnicalContradictions(data,p);
    expect(result.payload.winemakingTechniques).toContain(`${a}\n${b}\n`);
    expect(result.payload.winemakingTechniques).toContain('Sources disagree on time on lees: 9 months vs 10 months');
    expect(result.provenance?.fields.winemakingTechniques?.claims.slice(0,2)).toEqual(p.fields.winemakingTechniques!.claims.map(claim=>({...claim,supportStatus:'conflicting'})));
    expect(technicalContradictionScopePasses('wine_vintage',result.payload,result.provenance)).toBe(true);
    expect(highRiskTechnicalScopePasses('wine_vintage',result.payload,result.provenance)).toBe(true);
    expect(discloseTechnicalContradictions(result.payload,result.provenance)).toEqual(result);
    expect(data.winemakingTechniques).toBe(`${a}\n${b}`);
    expect(p.fields.winemakingTechniques?.claims.every(claim=>claim.supportStatus==='supported')).toBe(true);
  });

  it('discloses a cross-field disagreement in both affected sections',()=>{
    const a='Source A reports 30% new oak.',b='Source B reports 50% new oak.';
    const p=provenance([supported(b,'https://b.example/tech')]);p.fields.summary=summarizeFieldProvenance([supported(a,'https://a.example/tech')]);
    const result=discloseTechnicalContradictions({...payload(b),summary:a},p);
    for(const field of ['summary','winemakingTechniques'] as const){
      expect(result.payload[field]).toContain('Sources disagree on new oak percentage');
      expect(result.provenance?.fields[field]?.conflictingCount).toBeGreaterThan(0);
    }
  });

  it('leaves ungrounded technical claims rejected even when another disagreement can be disclosed',()=>{
    const a='Source A reports 30% new oak.',b='Source B reports 50% new oak.',unsupported='Fermentation lasted 25 days.';
    const result=discloseTechnicalContradictions(payload(`${a}\n${b}\n${unsupported}`),provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech'),{claim:unsupported,supportStatus:'unsupported',sourceTier:'none',sources:[]}]));
    expect(highRiskTechnicalScopePasses('wine_vintage',result.payload,result.provenance)).toBe(false);
  });

  it('leaves matching, already disclosed and evidence-free answers unchanged',()=>{
    const a='Source A reports 30% new oak.',b='Source B reports 50% new oak.';
    const data=payload(`${a}\n${b}\nSources conflict on the new-oak percentage.`),p=provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')]);
    expect(discloseTechnicalContradictions(data,p).payload).toEqual(data);
    expect(discloseTechnicalContradictions(payload(a),provenance([supported(a,'https://a.example/tech')])).payload).toEqual(payload(a));
    expect(discloseTechnicalContradictions(payload(a)).payload).toEqual(payload(a));
  });

  it('preserves schema-valid evidence when the original report already has 60 claims',()=>{
    const a='Source A reports 30% new oak.',b='Source B reports 50% new oak.';
    const claims=[a,b,...Array.from({length:58},(_,index)=>`Additional sourced observation number ${index}.`)];
    const result=discloseTechnicalContradictions(payload(claims.join('\n')),provenance(claims.map((claim,index)=>supported(claim,`https://source.example/${index}`))));
    expect(result.payload.winemakingTechniques).toContain('Sources disagree');
    expect(deepSearchProvenanceSchema.safeParse(result.provenance).success).toBe(true);
    expect(result.provenance?.fields.winemakingTechniques?.claims).toHaveLength(60);
  });

  it('marks the evidence as disputed without retrying when prose is at the saved field limit',()=>{
    const a='Source A reports 30% new oak.',b='Source B reports 50% new oak.';
    const data=payload(`${a}\n${b}\n${'Additional context. '.repeat(250)}`.slice(0,5000));
    const result=discloseTechnicalContradictions(data,provenance([supported(a,'https://a.example/tech'),supported(b,'https://b.example/tech')]));
    expect(deepSearchSchema.shape.winemakingTechniques.safeParse(result.payload.winemakingTechniques).success).toBe(true);
    expect(result.payload).toEqual(data);
    expect(result.provenance?.fields.winemakingTechniques?.conflictingCount).toBe(2);
    expect(technicalContradictionScopePasses('wine_vintage',result.payload,result.provenance)).toBe(true);
  });
});
