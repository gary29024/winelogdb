import { describe,expect,it } from 'vitest';
import { canonicalCatalogEntries,catalogHierarchyLabel } from '../../src/lib/cuvees/catalogPresentation';

describe('catalog presentation',()=>{
  it('collapses producer-prefixed duplicates onto one canonical catalog entry',()=>{
    const catalog=[
      {name:'Domaine Example Les Suchots',category:'red',appellation:'Vosne-Romanée Premier Cru',classification:'Premier Cru'},
      {name:'Les Suchots',category:'red',appellation:'Vosne-Romanée Premier Cru',classification:'Premier Cru',notes:'Older retained wording'}
    ];
    const result=canonicalCatalogEntries(catalog,['Domaine Example']);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Domaine Example Les Suchots');
    expect(result[0].notes).toBe('Older retained wording');
  });

  it('keeps same-name wines separate when style differs',()=>{
    const result=canonicalCatalogEntries([
      {name:'Tradition',category:'red',appellation:'Bourgogne'},
      {name:'Tradition',category:'white',appellation:'Bourgogne'}
    ],['Domaine Example']);
    expect(result).toHaveLength(2);
  });

  it('orders hierarchy first and then alphabetically',()=>{
    const result=canonicalCatalogEntries([
      {name:'Z Regional',category:'red',appellation:'Bourgogne',classification:'Regional'},
      {name:'B Premier',category:'red',appellation:'Volnay Premier Cru',classification:'Premier Cru'},
      {name:'B Grand',category:'red',appellation:'Clos de Vougeot Grand Cru',classification:'Grand Cru'},
      {name:'A Grand',category:'red',appellation:'Echezeaux Grand Cru',classification:'Grand Cru'},
      {name:'A Village',category:'red',appellation:'Vosne-Romanée',classification:'Village'}
    ],['Domaine Example']);
    expect(result.map(item=>item.name)).toEqual(['A Grand','B Grand','B Premier','A Village','Z Regional']);
    expect(result.map(catalogHierarchyLabel)).toEqual(['Grand Cru','Grand Cru','Premier Cru / 1er Cru','Village / appellation','Regional']);
  });
});
