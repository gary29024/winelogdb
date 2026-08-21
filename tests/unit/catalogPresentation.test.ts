import { describe,expect,it } from 'vitest';
import { canonicalCatalogEntries,catalogChoicesForPresentation,catalogHierarchyLabel,catalogRowsForPresentation } from '../../src/lib/cuvees/catalogPresentation';

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

  it('treats generic Domaine plus the known producer name as presentation-only',()=>{
    const catalog=[
      {name:'Domaine Pierre Vincent Volnay 1er Cru Le Ronceret',category:'red',appellation:'Volnay Premier Cru',classification:'Premier Cru'},
      {name:'Volnay 1er Cru Le Ronceret',category:'red',appellation:'Volnay Premier Cru',classification:'Premier Cru'}
    ];
    const rows=[{id:'ronceret',canonicalName:'Volnay 1er Cru Le Ronceret',appellation:'Volnay Premier Cru',wineStyle:'red'}];
    expect(canonicalCatalogEntries(catalog,['Pierre Vincent'])).toHaveLength(1);
    expect(catalogChoicesForPresentation(catalog,['Pierre Vincent'],rows)[0]).toMatchObject({id:'ronceret',canonicalName:'Volnay 1er Cru Le Ronceret'});
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

  it('builds link choices from the same canonical catalog and keeps unresolved wines visible',()=>{
    const catalog=[
      {name:"Successeurs Corton Grand Cru 'Les Renardes'",category:'red',appellation:'Corton',classification:'Grand Cru'},
      {name:'Corton Les Rognets Grand Cru',category:'red',appellation:'Corton',classification:'Grand Cru'},
      {name:'Aloxe-Corton 1er Cru La Toppe au Vert',category:'red',appellation:'Aloxe-Corton',classification:'Premier Cru'},
      {name:'Clos de Vougeot Grand Cru',category:'red',appellation:'Clos de Vougeot',classification:'Grand Cru'},
      {name:'Corton Les Renardes Grand Cru',category:'red',appellation:'Corton',classification:'Grand Cru'}
    ];
    const rows=[
      {id:'clos',canonicalName:'Clos de Vougeot Grand Cru',appellation:'Clos de Vougeot',wineStyle:'red'},
      {id:'rognets',canonicalName:'Corton Les Rognets Grand Cru',appellation:'Corton',wineStyle:'red'},
      {id:'successeurs',canonicalName:"Successeurs Corton Grand Cru 'Les Renardes'",appellation:'Corton',wineStyle:'red'},
      {id:'toppe',canonicalName:'Aloxe-Corton 1er Cru La Toppe au Vert',appellation:'Aloxe-Corton',wineStyle:'red'}
    ];
    const choices=catalogChoicesForPresentation(catalog,['Thibault Liger-Belair'],rows);
    expect(choices.map(item=>item.canonicalName)).toEqual([
      'Clos de Vougeot Grand Cru',
      'Corton Les Renardes Grand Cru',
      'Corton Les Rognets Grand Cru',
      "Successeurs Corton Grand Cru 'Les Renardes'",
      'Aloxe-Corton 1er Cru La Toppe au Vert'
    ]);
    expect(choices).toHaveLength(canonicalCatalogEntries(catalog,['Thibault Liger-Belair']).length);
    expect(choices.find(item=>item.canonicalName==='Corton Les Renardes Grand Cru')).toMatchObject({id:null,hierarchy:'Grand Cru',issue:'Catalog identity needs repair'});
    expect(choices.filter(item=>item.id)).toHaveLength(4);
  });

  it('uses catalog wording while preserving the matching D1 identity and tasting stats',()=>{
    const catalog=[{name:'Clos de Vougeot Grand Cru',category:'red',appellation:'Clos de Vougeot',classification:'Grand Cru'}];
    const rows=[{id:'clos',canonicalName:'Clos Vougeot Grand Cru',appellation:'Clos de Vougeot',wineStyle:'red',tastedCount:1,tastedVintages:[2023]}];
    const choices=catalogChoicesForPresentation(catalog,['Thibault Liger-Belair'],rows);
    expect(choices[0]).toMatchObject({id:'clos',canonicalName:'Clos de Vougeot Grand Cru',issue:null});
    const projected=catalogRowsForPresentation(catalog,['Thibault Liger-Belair'],rows);
    expect(projected[0]).toMatchObject({id:'clos',canonicalName:'Clos de Vougeot Grand Cru',tastedCount:1,tastedVintages:[2023]});
  });
});
