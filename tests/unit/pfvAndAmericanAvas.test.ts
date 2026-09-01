import { describe,expect,it } from 'vitest';
import { pfvAndAmericanAvaDefinitions } from '../../src/features/achievements/pfvAndAmericanAvas';

const byId=(id:string)=>{
  const definition=pfvAndAmericanAvaDefinitions.find(item=>item.id===id);
  if(!definition)throw new Error(`Missing definition ${id}`);
  return definition;
};

describe('PFV and American AVA curated achievements',()=>{
  it('tracks the twelve current Primum Familiae Vini member families',()=>{
    const definition=byId('primum-familiae-vini-12');
    expect(definition.items).toHaveLength(12);
    expect(definition.items.map(item=>item.label)).toEqual([
      'Baron Philippe de Rothschild','Domaine Clarence Dillon','Egon Müller Scharzhof','Familia Torres','Famille Hugel','Famille Perrin',
      'Maison Joseph Drouhin','Marchesi Antinori','Pol Roger','Symington Family Estates','Tempos Vega Sicilia','Tenuta San Guido'
    ]);
    expect(definition.items.every(item=>item.selector.type==='producer')).toBe(true);
  });

  it('uses the current seventeen Napa Valley nested AVAs, including Crystal Springs',()=>{
    const definition=byId('napa-valley-17-nested-avas');
    expect(definition.items).toHaveLength(17);
    expect(definition.items.map(item=>item.label)).toContain('Crystal Springs of Napa Valley');
    expect(definition.items.every(item=>item.selector.type==='appellation')).toBe(true);
  });

  it('tracks all eleven Willamette Valley nested AVAs',()=>{
    const definition=byId('willamette-valley-11-nested-avas');
    expect(definition.items).toHaveLength(11);
    expect(definition.items.map(item=>item.label)).toEqual([
      'Chehalem Mountains','Dundee Hills','Eola-Amity Hills','Laurelwood District','Lower Long Tom','McMinnville',
      'Mount Pisgah, Polk County, Oregon','Ribbon Ridge','Tualatin Hills','Van Duzer Corridor','Yamhill-Carlton'
    ]);
    expect(definition.items.every(item=>item.selector.type==='appellation')).toBe(true);
  });
});
