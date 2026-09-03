import { describe,expect,it } from 'vitest';
import { canonicalGrapeName,displayGrapeName,grapeGroup,grapeSuggestions,knownGrape,GRAPES } from '../../src/lib/wine/grapes';
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

  it('is never what gets stored',()=>{
    // The bottle says Pinot Nero. Saving it as Pinot Noir would be the app
    // rewriting the label, and the grouping belongs where things are counted.
    const wine=canonicalizeWineFields({grapes:['pinot nero','garnacha'],
      grapeBlend:[{grape:'pinot nero',percentage:80},{grape:'garnacha',percentage:20}]});
    expect(wine.grapes).toEqual(['Pinot Nero','Garnacha']);
    expect(wine.grapeBlend).toEqual([{grape:'Pinot Nero',percentage:80},{grape:'Garnacha',percentage:20}]);
  });
});

describe('the spelling a grape is stored with',()=>{
  it('fixes the capitals and the accent of the name that was typed, and stops',()=>{
    expect(displayGrapeName('pinot nero')).toBe('Pinot Nero');
    expect(displayGrapeName('spatburgunder')).toBe('Spätburgunder');
    expect(displayGrapeName('GARNACHA')).toBe('Garnacha');
    expect(displayGrapeName('cabernet sauvignon')).toBe('Cabernet Sauvignon');
  });

  it('is not overridden by an alias that differs only by punctuation',()=>{
    // "Cabernet-Sauvignon" is listed so it matches, not so it replaces the name.
    expect(displayGrapeName('Cabernet-Sauvignon')).toBe('Cabernet Sauvignon');
  });

  it('leaves a grape the table does not know exactly as typed',()=>{
    expect(displayGrapeName('rossese di dolceacqua')).toBe('rossese di dolceacqua');
  });
});

describe('finding every bottle of one grape',()=>{
  it('asks for all the names it is stored under',()=>{
    // The count on the insight and the list behind it have to agree.
    const group=grapeGroup('Pinot Noir');
    expect(group).toContain('Pinot Noir');
    expect(group).toContain('Pinot Nero');
    expect(group).toContain('Spätburgunder');
    expect(grapeGroup('Pinot Nero')).toEqual(group);
  });

  it('is just the name itself for a grape the table does not know',()=>{
    expect(grapeGroup('Rossese')).toEqual(['Rossese']);
    expect(grapeGroup('')).toEqual([]);
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

describe('folding the spellings when they are counted',()=>{
  it('adds one vine up once, under the name the group is known by',async()=>{
    const {buildJourneyPayload}=await import('../../worker/journeyHandler');
    const {createD1Stub}=await import('./support/d1Stub');
    const rows=[{grape:'Pinot Noir',wines:9,favorites:2},{grape:'Pinot Nero',wines:4,favorites:1},
      {grape:'Spätburgunder',wines:2,favorites:0},{grape:'Chardonnay',wines:12,favorites:3}];
    const stub=createD1Stub(sql=>/json_each\(CASE WHEN json_valid\(w\.grapes_json\)/.test(sql)?{all:rows}:{all:[]});
    const payload=await buildJourneyPayload(stub.db,'owner') as {grapes:Array<{grape:string;wines:number;favorites:number}>};
    expect(payload.grapes[0]).toEqual({grape:'Pinot Noir',wines:15,favorites:3});
    expect(payload.grapes.map(entry=>entry.grape)).not.toContain('Pinot Nero');
    // and the order follows the folded totals, not the raw ones
    expect(payload.grapes[1]).toEqual({grape:'Chardonnay',wines:12,favorites:3});
  });
});
