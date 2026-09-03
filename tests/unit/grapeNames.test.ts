import { describe,expect,it } from 'vitest';
import { canonicalGrapeName,grapeSuggestions,knownGrape,GRAPES } from '../../src/lib/wine/grapes';
import { canonicalizeWineFields } from '../../src/lib/wine/canonicalize';

describe('the name a grape is filed under',()=>{
  it('folds the other names one grape is sold under into it',()=>{
    // Reported as: grapes in different names are not grouping together. They
    // were three grapes in every count, filter and insight, and one vine.
    for(const alias of ['Pinot Nero','Spätburgunder','Blauburgunder','pinot nero'])
      expect(canonicalGrapeName(alias)).toBe('Pinot Noir');
    expect(canonicalGrapeName('Garnacha')).toBe('Grenache');
    expect(canonicalGrapeName('Tinta de Toro')).toBe('Tempranillo');
    expect(canonicalGrapeName('Zinfandel')).toBe('Primitivo');
    expect(canonicalGrapeName('Weissburgunder')).toBe('Pinot Blanc');
  });

  it('keeps the names a drinker uses to mean a style',()=>{
    // The convention the old map already followed. Grouping these would be
    // varietally right and would erase a distinction the person logging the
    // bottle meant to make.
    expect(canonicalGrapeName('Shiraz')).toBe('Shiraz');
    expect(canonicalGrapeName('Syrah')).toBe('Syrah');
    expect(canonicalGrapeName('Pinot Grigio')).toBe('Pinot Grigio');
    expect(canonicalGrapeName('Pinot Gris')).toBe('Pinot Gris');
  });

  it('leaves a grape it has never heard of exactly as typed',()=>{
    // A curated table that quietly renamed the things it does not know would be
    // worse than one that admits its edges.
    expect(canonicalGrapeName('Rossese di Dolceacqua')).toBe('Rossese di Dolceacqua');
    expect(knownGrape('Rossese di Dolceacqua')).toBe(false);
    expect(canonicalGrapeName('  ')).toBe('');
  });

  it('reads accents and case as the same name',()=>{
    expect(canonicalGrapeName('spatburgunder')).toBe('Pinot Noir');
    expect(canonicalGrapeName('MOURVEDRE')).toBe('Mourvèdre');
    expect(canonicalGrapeName("nero d'avola")).toBe('Nero d’Avola');
  });

  it('never files two grapes under one another by accident',()=>{
    const seen=new Map<string,string>();
    for(const entry of GRAPES)for(const name of [entry.name,...entry.also??[]]){
      const key=canonicalGrapeName(name);
      const owner=seen.get(name.toLowerCase());
      expect(owner===undefined||owner===key,`${name} claimed by ${owner} and ${key}`).toBe(true);
      seen.set(name.toLowerCase(),key);
    }
  });

  it('carries through the canonicaliser a wine is saved with',()=>{
    const wine=canonicalizeWineFields({grapes:['Pinot Nero','Garnacha'],
      grapeBlend:[{grape:'Pinot Nero',percentage:80},{grape:'garnacha',percentage:20}]});
    expect(wine.grapes).toEqual(['Pinot Noir','Grenache']);
    expect(wine.grapeBlend).toEqual([{grape:'Pinot Noir',percentage:80},{grape:'Grenache',percentage:20}]);
  });
});

describe('finishing a half-typed grape',()=>{
  it('offers the name it will be stored as, not the one being typed',()=>{
    // Offering "Spätburgunder" as a choice that silently becomes Pinot Noir is
    // worse than offering nothing.
    expect(grapeSuggestions('spat')).toEqual(['Pinot Noir']);
    expect(grapeSuggestions('garnach')).toContain('Grenache');
    expect(grapeSuggestions('garnach')).not.toContain('Garnacha');
  });

  it('puts a name that starts with what was typed before one that merely holds it',()=>{
    const found=grapeSuggestions('cabernet');
    expect(found.slice(0,2).sort()).toEqual(['Cabernet Franc','Cabernet Sauvignon']);
  });

  it('says nothing until there is enough to go on',()=>{
    expect(grapeSuggestions('')).toEqual([]);
    expect(grapeSuggestions('p')).toEqual([]);
    expect(grapeSuggestions('qqq')).toEqual([]);
  });

  it('stays short enough to sit under a field on a phone',()=>{
    expect(grapeSuggestions('in').length).toBeLessThanOrEqual(6);
  });
});
