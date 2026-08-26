import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';
import { pourFamily } from '../../src/lib/wine/pourFamily';

describe('which colour a photo-less wine shows',()=>{
  it('reads the eight styles recognition actually writes',()=>{
    expect(['red','white','rose','sparkling','dessert','fortified','orange','other'].map(pourFamily))
      .toEqual(['red','white','rose','sparkling','sweet','sweet','orange','unknown']);
  });

  it('shelves a sparkling rose with the sparklings',()=>{
    // Order matters here: a wine can be two of these words at once, and the
    // bubbles are what a reader is scanning for.
    expect(pourFamily('Sparkling Rosé')).toBe('sparkling');
    expect(pourFamily('Blanc de Blancs Champagne')).toBe('sparkling');
  });

  it('understands a label written in its own language',()=>{
    expect(['Rosso','Tinto','Rouge'].map(pourFamily)).toEqual(['red','red','red']);
    expect(['Bianco','Blanco','Blanc'].map(pourFamily)).toEqual(['white','white','white']);
    expect(['Rosato','Rosado'].map(pourFamily)).toEqual(['rose','rose']);
    expect(pourFamily('Crémant')).toBe('sparkling');
  });

  it('lands anything it cannot read on the neutral tile',()=>{
    // A wrong colour is worse than no colour: the tile is meant to be scanned,
    // so a guess would be read as fact.
    expect([null,undefined,'','   ','Natural','Vin de France'].map(pourFamily))
      .toEqual(['unknown','unknown','unknown','unknown','unknown','unknown']);
  });

  it('has a tint declared for every family it can return',()=>{
    // The class name is built from the return value, so a family with no
    // matching rule renders the neutral tile silently.
    const styles=readFileSync(join(process.cwd(),'src','styles.css'),'utf8');
    const families=['red','white','rose','sparkling','orange','sweet'];
    expect(families.filter(family=>!styles.includes(`.bottle-${family}`))).toEqual([]);
  });
});
