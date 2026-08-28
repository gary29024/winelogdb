import { describe,expect,it } from 'vitest';
import { producerLinkChoices } from '../../src/lib/producers/linkChoices';

describe('producer alias-link choices',()=>{
  it('excludes the current producer and sorts the whole directory alphabetically',()=>{
    const choices=producerLinkChoices([
      {id:'australia-z',canonicalName:'Yarra Yering',region:'Victoria'},
      {id:'france-a',canonicalName:'Domaine A',region:'Burgundy'},
      {id:'current',canonicalName:'Clarendon Hills',region:'South Australia'},
      {id:'australia-a',canonicalName:'Dormilona',region:'Western Australia'}
    ],'current');
    expect(choices.map(item=>item.canonicalName)).toEqual(['Domaine A','Dormilona','Yarra Yering']);
  });
});
