import { describe,expect,it } from 'vitest';
import { resolvePlace } from '../../src/lib/places/resolve';

const denomination=(country:string|null,region:string|null,appellation:string|null)=>
  resolvePlace({country,region,appellation}).denomination;

describe('The denomination an appellation holds',()=>{
  it('inherits the country default where the appellation says nothing else',()=>{
    // Three hundred Italian entries are DOCs; marking each one would be a
    // transcription exercise with three hundred chances to be wrong.
    expect(denomination('Italy','Tuscany','Bolgheri')).toBe('DOC');
    expect(denomination('France','Burgundy','Vosne-Romanée')).toBe('AOC');
    expect(denomination('United States','Napa Valley','Oakville')).toBe('AVA');
    expect(denomination('Australia','South Australia','Barossa Valley')).toBe('GI');
  });

  it('takes the appellation’s own denomination over the country default',()=>{
    expect(denomination('Italy','Piedmont','Barolo')).toBe('DOCG');
    expect(denomination('Italy','Tuscany','Chianti Classico')).toBe('DOCG');
    expect(denomination('Italy','Tuscany','Brunello di Montalcino')).toBe('DOCG');
    expect(denomination('Italy','Campania','Taurasi')).toBe('DOCG');
  });

  it('answers the same whether or not the label spelled the term out',()=>{
    // The resolver strips a trailing denomination, so "Barolo DOCG" and "Barolo"
    // are one place - and the term comes back from the tree either way.
    expect(denomination('Italy','Piedmont','Barolo DOCG')).toBe('DOCG');
    expect(denomination('Italy','Tuscany','Chianti Classico DOCG')).toBe('DOCG');
    expect(denomination('Spain','Rioja','Rioja Alta DOCa')).toBe('DOCa');
  });

  it('reads a region that is itself a denomination',()=>{
    // A wine logged as plain Rioja has no appellation to hang the term on, and
    // Rioja is exactly the name the DOCa covers.
    expect(denomination('Spain','Rioja',null)).toBe('DOCa');
    expect(denomination('Spain','Priorat',null)).toBe('DOQ');
    expect(denomination('Portugal','Douro',null)).toBe('DOC');
    expect(denomination('Spain','Ribera del Duero',null)).toBe('DO');
  });

  it('stays quiet on a region that is only an administrative area',()=>{
    // Bourgogne is an AOC; Burgundy is not. Inheriting the country default up
    // here would print a legal claim the bottle does not make.
    expect(denomination('France','Burgundy',null)).toBeNull();
    expect(denomination('Italy','Tuscany',null)).toBeNull();
    expect(denomination('Spain','Catalonia',null)).toBeNull();
    expect(denomination('United States','California',null)).toBeNull();
    expect(denomination('France',null,null)).toBeNull();
  });

  it('stays quiet on a name the tree does not know',()=>{
    // Recognition invents appellations. "AVA" beside one would dress a guess up
    // as a registration.
    expect(denomination('United States','Napa Valley','Screaming Hollow Vineyard')).toBeNull();
    expect(denomination('Italy','Tuscany','Podere Non Esiste')).toBeNull();
  });

  it('follows the appellation the wine actually names, not the field it arrived in',()=>{
    // Region Tuscany + appellation Chianti Classico, and the reverse slotting,
    // are one wine; the denomination must not depend on which way round it came.
    expect(denomination('Italy','Chianti Classico',null)).toBe('DOCG');
    expect(denomination('Italy','Tuscany','Chianti Classico')).toBe('DOCG');
  });
});
