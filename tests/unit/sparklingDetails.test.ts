import { describe,expect,it } from 'vitest';
import { emptySparklingDetails,hasSparklingDetails,sparklingDetailsSchema } from '../../src/lib/wine/sparklingDetails';

describe('sparkling release details',()=>{
  it('keeps compact comparable values and producer wording together',()=>{
    const parsed=sparklingDetailsSchema.parse({
      dosageGPerL:2.5,dosageCategory:'Extra Brut',disgorgement:'03/2024',tirage:'07/2019',
      baseVintage:2018,reserveWinePercentage:35,leesAgeingMonths:53,lotCode:'DT0324',
      assemblage:'2018 base with reserve wines',reserveWineDetail:'Perpetual reserve 2014–2017',
      malolactic:'Blocked',fermentationElevage:'70% steel, 30% oak',otherTechnicalDetails:null
    });
    expect(parsed.dosageGPerL).toBe(2.5);
    expect(parsed.disgorgement).toBe('03/2024');
    expect(parsed.assemblage).toContain('2018 base');
    expect(hasSparklingDetails(parsed)).toBe(true);
  });

  it('treats an empty release profile as absent',()=>{
    expect(hasSparklingDetails(emptySparklingDetails)).toBe(false);
    expect(sparklingDetailsSchema.parse({dosageGPerL:'   ',reserveWinePercentage:'\t'})).toMatchObject({dosageGPerL:null,reserveWinePercentage:null});
    expect(sparklingDetailsSchema.parse({dosageGPerL:'',disgorgement:'  '})).toMatchObject({dosageGPerL:null,disgorgement:null});
  });

  it('rejects impossible percentages and vintages',()=>{
    expect(sparklingDetailsSchema.safeParse({reserveWinePercentage:101}).success).toBe(false);
    expect(sparklingDetailsSchema.safeParse({baseVintage:999}).success).toBe(false);
  });
});
