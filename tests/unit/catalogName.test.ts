import { describe,expect,it } from 'vitest';
import { catalogNameInitial,stripProducerCatalogPrefix } from '../../src/lib/producers/catalogName';

describe('producer catalog names',()=>{
  it('removes a generic house prefix only when it repeats a known producer',()=>{
    expect(stripProducerCatalogPrefix('Domaine Pierre Vincent Volnay 1er Cru Le Ronceret',['Pierre Vincent'])).toBe('Volnay 1er Cru Le Ronceret');
    expect(stripProducerCatalogPrefix('Maison Pierre Vincent Bourgogne Chardonnay',['Pierre Vincent'])).toBe('Bourgogne Chardonnay');
    expect(stripProducerCatalogPrefix('Domaine des Croix Beaune',['Pierre Vincent'])).toBe('Domaine des Croix Beaune');
  });

  it('classifies the first significant catalogue initial after producer cleanup',()=>{
    expect(catalogNameInitial('Domaine Pierre Vincent Échezeaux Grand Cru',['Pierre Vincent'])).toBe('E');
    expect(catalogNameInitial('2024 Special Cuvée',['Pierre Vincent'])).toBeNull();
    expect(catalogNameInitial('“Volnay”',['Pierre Vincent'])).toBe('V');
  });
});
