import { describe,expect,it } from 'vitest';
import { dedupeManualProducerContacts } from '../../src/lib/producers/manualContacts';

describe('supplementary contacts across producer aliases',()=>{
  it('keeps the canonical producer copy first when an active merged producer carries the same contact',()=>{
    const rows=[
      {id:'canonical',type:'phone' as const,label:'Appointments',value:'+33 3 80 00 00 00',note:null,createdAt:'2026-01-01',updatedAt:'2026-01-01'},
      {id:'source',type:'phone' as const,label:'Appointments',value:'+33 3 80 00 00 00',note:null,createdAt:'2025-01-01',updatedAt:'2025-01-01'}
    ];
    expect(dedupeManualProducerContacts(rows)).toEqual([rows[0]]);
  });
});
