import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { describe,expect,it } from 'vitest';
import { resolvePlace } from '../../src/lib/places/resolve';
import { canonicalizeWineFields } from '../../src/lib/wine/canonicalize';

const burgundy=(appellation:string,wineName='')=>
  resolvePlace({country:'France',region:'Burgundy',appellation,wineName});

describe('The Chablis pyramid',()=>{
  it('reads plain Chablis as the village AOC it is',()=>{
    // The tree files Chablis as a subregion because it holds its own pyramid,
    // and the tier alone had been deciding whether a place could say village -
    // so the one village in Burgundy with children below it said nothing.
    expect(burgundy('Chablis')).toMatchObject({appellation:'Chablis',classification:'village',denomination:'AOC'});
  });

  it('keeps the three tiers above and below it apart',()=>{
    expect(burgundy('Petit Chablis').classification).toBeNull();
    expect(burgundy('Chablis Premier Cru').classification).toBe('premier_cru');
    expect(burgundy('Chablis Grand Cru').classification).toBe('grand_cru');
  });

  it('reads a named climat as its appellation, at the tier the label says',()=>{
    expect(burgundy('Chablis 1er Cru Montée de Tonnerre'))
      .toMatchObject({appellation:'Chablis',classification:'premier_cru'});
    expect(burgundy('Chablis Grand Cru Les Clos'))
      .toMatchObject({appellation:'Chablis Grand Cru',classification:'grand_cru'});
  });

  it('is not downgraded by a re-save, the way any other village is not',()=>{
    const first=canonicalizeWineFields({producer:'Raveneau',wineName:'Montée de Tonnerre',
      country:'France',region:'Burgundy',appellation:'Chablis 1er Cru Montée de Tonnerre',classification:null});
    expect(first).toMatchObject({appellation:'Chablis',classification:'premier_cru'});
    expect(canonicalizeWineFields({...first}).classification).toBe('premier_cru');
  });
});

describe('The village AOCs south of the Côte d’Or',()=>{
  it('reads the Côte Chalonnaise and Mâconnais villages as villages',()=>{
    // These were built as plain appellations while the Côte de Nuits and Côte
    // de Beaune beside them were built as villages, so the tier a wine got
    // depended on which half of Burgundy it came from.
    for(const name of ['Mercurey','Givry','Rully','Montagny','Bouzeron','Pouilly-Fuissé','Saint-Véran','Viré-Clessé'])
      expect(burgundy(name).classification,name).toBe('village');
  });

  it('leaves Mâcon-Villages alone, which is regional despite the name',()=>{
    expect(burgundy('Mâcon-Villages').classification).toBeNull();
  });
});

describe('A trailing denomination is not unread text',()=>{
  it('still reads the village where the label spelled the scheme out',()=>{
    // The village reading is withheld on an inexact match because the dropped
    // text may be a premier cru climat. A denomination is a closed list, so
    // there is no room left for one.
    expect(burgundy('Chablis AOC').classification).toBe('village');
    expect(burgundy('Meursault AOC').classification).toBe('village');
  });

  it('still withholds it where the dropped text could be a climat',()=>{
    expect(burgundy('Vosne Romanee Suchots').classification).toBeNull();
  });
});

describe('the tier backfill for wines already logged',()=>{
  const sql=readFileSync(resolvePath(process.cwd(),'src/lib/db/migrations/0034_chablis_village_appellations.sql'),'utf8');

  it('covers every name the tree newly classifies',()=>{
    for(const name of ['Chablis','Mercurey','Givry','Rully','Montagny','Bouzeron',
      'Pouilly-Fuissé','Saint-Véran','Viré-Clessé','Chablis Premier Cru'])
      expect(sql,name).toContain(`'${name}'`);
  });

  it('leaves a tier that was cleared by hand cleared',()=>{
    // A NULL classification beside an override is a decision, not a gap.
    expect(sql.match(/classification IS NULL AND classification_override IS NULL/g)).toHaveLength(2);
  });
});
