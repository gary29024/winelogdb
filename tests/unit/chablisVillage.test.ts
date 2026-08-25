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
      'Pouilly-Fuissé','Saint-Véran','Viré-Clessé','Côte de Beaune','Irancy','Saint-Bris','Chablis Premier Cru'])
      expect(sql,name).toContain(`'${name}'`);
  });

  it('leaves a tier that was cleared by hand cleared',()=>{
    // A NULL classification beside an override is a decision, not a gap.
    expect(sql.match(/classification IS NULL AND classification_override IS NULL/g)).toHaveLength(2);
  });
});

describe('The tier below the villages',()=>{
  it('reads Burgundy’s regional appellations as AOCs with no cru tier',()=>{
    // These are real appellations and say so, but a Hautes Côtes is not a
    // village; counting one as such would inflate the cru mix on Insights.
    for(const name of ['Bourgogne Hautes Côtes de Nuits','Bourgogne Hautes Côtes de Beaune',
      'Bourgogne Côte Chalonnaise','Bourgogne Passe-Tout-Grains','Coteaux Bourguignons',
      'Crémant de Bourgogne','Mâcon','Bourgogne Rouge'])
      expect(burgundy(name),name).toMatchObject({classification:null,denomination:'AOC'});
  });

  it('settles the short forms on one spelling',()=>{
    // Recognition writes the Hautes Côtes with and without the Bourgogne prefix,
    // and with either hyphenation, which forked one appellation into four.
    for(const name of ['Hautes Côtes de Nuits','Hautes-Cotes de Nuits','hautes cotes de nuits'])
      expect(burgundy(name).appellation,name).toBe('Bourgogne Hautes Côtes de Nuits');
    expect(burgundy('Macon').appellation).toBe('Mâcon');
    expect(burgundy('Vézelay').appellation).toBe('Bourgogne Vézelay');
  });

  it('reads the Grand Auxerrois village AOCs as villages',()=>{
    expect(burgundy('Irancy').classification).toBe('village');
    expect(burgundy('Saint-Bris').classification).toBe('village');
  });
});

describe('Côte de Beaune, which names two things',()=>{
  it('is a village where the appellation field names it',()=>{
    // The AOC on the hill above Beaune. A label saying only "Côte de Beaune"
    // means that wine, not the stretch of hillside.
    expect(burgundy('Côte de Beaune')).toMatchObject({classification:'village',denomination:'AOC'});
  });

  it('is only the subregion where the region field named it',()=>{
    // Recognition routinely writes the subregion in the region field, and that
    // is not a claim about the wine's tier.
    expect(resolvePlace({country:'France',region:'Côte de Beaune',appellation:null}))
      .toMatchObject({appellation:'Côte de Beaune',classification:null});
    expect(resolvePlace({country:'France',region:'Côte de Beaune',appellation:'Volnay'}))
      .toMatchObject({appellation:'Volnay',classification:'village'});
  });

  it('keeps Côte de Nuits unclassified, which is not an AOC',()=>{
    expect(burgundy('Côte de Nuits')).toMatchObject({classification:null,denomination:null});
    expect(burgundy('Côte de Nuits-Villages').classification).toBe('village');
  });
});
