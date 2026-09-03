import { describe,expect,it } from 'vitest';
import { wineInputSchema } from '../../src/lib/db/schema';

const calvados={producer:'Michel Huard',wineName:'Calvados',vintage:2013,country:'France',region:'Normandy',
  appellation:'Calvados',wineStyle:'other' as const,alcoholPercentage:46,
  grapes:[],grapeBlend:[],tags:[],tastingNotes:'',recognitionStatus:'complete' as const};

describe('what strength a bottle may be',()=>{
  it('takes what gets poured after the wine',()=>{
    // Reported as "Invalid wine" on a Calvados at 46%. Thirty was a wine
    // ceiling, and this journal holds the digestif as well.
    expect(wineInputSchema.safeParse(calvados).success).toBe(true);
    for(const strength of [40,46,55,70])
      expect(wineInputSchema.safeParse({...calvados,alcoholPercentage:strength}).success,`${strength}%`).toBe(true);
  });

  it('still catches the misread decimal point the ceiling is for',()=>{
    // 13.5 arriving as 135 is the mistake worth refusing.
    expect(wineInputSchema.safeParse({...calvados,alcoholPercentage:135}).success).toBe(false);
    expect(wineInputSchema.safeParse({...calvados,alcoholPercentage:-1}).success).toBe(false);
  });

  it('names the field when it refuses',()=>{
    // "Invalid wine" on its own is true, useless, and what the batch review
    // showed: the server has always sent the failing field.
    const parsed=wineInputSchema.safeParse({...calvados,alcoholPercentage:135});
    expect(parsed.success).toBe(false);
    if(!parsed.success)expect(parsed.error.issues[0].path).toEqual(['alcoholPercentage']);
  });
});
