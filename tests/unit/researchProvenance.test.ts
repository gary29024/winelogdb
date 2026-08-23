import { describe,expect,it } from 'vitest';
import { buildDeepSearchProvenance,buildFieldProvenance } from '../../src/lib/research/provenance';
import type { GroundingMetadata } from '../../src/lib/research/geminiBatch';

const metadata:GroundingMetadata={
  groundingChunks:[
    {web:{title:'Producer technical sheet',uri:'https://producer.example/2021-tech'}},
    {web:{title:'Regional vintage report',uri:'https://www.bourgogne-wines.com/2021-report'}}
  ],
  groundingSupports:[
    {segment:{text:'For 2021, the wine was matured for 16 months in barrel.'},groundingChunkIndices:[0]},
    {segment:{text:'The 2021 growing season was cool and harvest was delayed.'},groundingChunkIndices:[1]}
  ]
};

describe('claim-level research provenance',()=>{
  it('maps a directly grounded claim to the exact source',()=>{
    const result=buildFieldProvenance('For 2021, the wine was matured for 16 months in barrel.',metadata);
    expect(result.claimCount).toBe(1);
    expect(result.supportedCount).toBe(1);
    expect(result.directSupportRatio).toBe(1);
    expect(result.claims[0].supportStatus).toBe('supported');
    expect(result.claims[0].sources).toEqual([{title:'Producer technical sheet',url:'https://producer.example/2021-tech'}]);
  });

  it('marks only partially matched compound claims as partial support',()=>{
    const result=buildFieldProvenance('For 2021, the wine was matured for 16 months in barrel and bottled without filtration.',metadata);
    expect(result.claims[0].supportStatus).toBe('partial');
    expect(result.partialCount).toBe(1);
    expect(result.directSupportRatio).toBe(.5);
  });

  it('keeps unsupported assertions explicit instead of borrowing pooled sources',()=>{
    const result=buildFieldProvenance('The wine used 80% whole bunches.',metadata);
    expect(result.claims[0].supportStatus).toBe('unsupported');
    expect(result.claims[0].sources).toEqual([]);
    expect(result.directSupportRatio).toBe(0);
  });

  it('treats an honest cannot-verify statement as uncertainty without inventing a citation',()=>{
    const result=buildFieldProvenance('Exact 2021 whole-cluster information could not be verified in reliable public sources.');
    expect(result.claims[0].supportStatus).toBe('uncertainty');
    expect(result.uncertaintyCount).toBe(1);
    expect(result.unsupportedCount).toBe(0);
    expect(result.directSupportRatio).toBe(1);
  });

  it('keeps field-specific evidence separate',()=>{
    const provenance=buildDeepSearchProvenance({
      winemakingTechniques:'For 2021, the wine was matured for 16 months in barrel.',
      vintageQuality:'The 2021 growing season was cool and harvest was delayed.'
    },metadata);
    expect(provenance.fields.winemakingTechniques?.claims[0].sources[0].title).toBe('Producer technical sheet');
    expect(provenance.fields.vintageQuality?.claims[0].sources[0].title).toBe('Regional vintage report');
    expect(provenance.fields.vintageQuality?.claims[0].sourceTier).toBe('authoritative');
  });
});
