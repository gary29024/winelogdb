import { describe,expect,it } from 'vitest';
import { grapeExpect,type ConditionsReading } from '../../src/features/vintages/model';

const reading=(warmth:string,rot='Usual',ripeness='Usual',heat=false):ConditionsReading=>({title:'',verdict:'Mixed',conditions:[
  {id:'warmth',icon:'sun',label:'Warmth',value:warmth,usual:'',effect:'neutral'},
  {id:'heat',icon:'flame',label:'Heat stress',value:'',usual:'',effect:heat?'hurts':'neutral'},
  {id:'rain',icon:'drop',label:'Rot risk',value:rot,usual:'',effect:'neutral'},
  {id:'ripeness',icon:'clock',label:'Ripeness',value:ripeness,usual:'',effect:'neutral'}
]});
const typical={warmth:0,rain:0,nights:0} as const;

describe('grape-specific expectation',()=>{
  it('reads the same hot season differently for red and white',()=>{
    const hot=reading('Warmer','Usual','Riper',true);
    expect(grapeExpect('pinot-noir',hot,typical,-20,'shared')).toMatch(/dark, ripe, full reds/);
    expect(grapeExpect('chardonnay',hot,typical,-20,'shared')).toMatch(/whites with low acidity/);
  });
  it('treats short-of-ripe sugar in a warm year as early picking, not unripe wine',()=>{
    expect(grapeExpect('chardonnay',reading('Warmer','Usual','Short of ripe'),typical,-20,'shared')).toMatch(/picking began before/);
    expect(grapeExpect('pinot-noir',reading('Cooler','Usual','Short of ripe'),typical,10,'shared')).toMatch(/lean/);
  });
  it('keeps the wet-season warning when rain came before véraison',()=>{
    expect(grapeExpect('chardonnay',reading('Usual'),{warmth:0,rain:2,nights:0},0,'shared')).toMatch(/sorted hardest/);
  });
  it('falls back to the season line without the four drivers',()=>{
    expect(grapeExpect('pinot-noir',null,typical,0,'shared')).toBe('shared');
  });
});
