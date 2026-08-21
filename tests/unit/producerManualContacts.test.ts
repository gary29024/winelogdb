import { describe,expect,it } from 'vitest';
import { dedupeManualProducerContacts,normalizeManualProducerContact } from '../../src/lib/producers/manualContacts';

describe('producer supplementary contacts',()=>{
  it('normalizes common manually entered contacts',()=>{
    expect(normalizeManualProducerContact({type:'email',value:' INFO@Domaine.Example ',label:'Appointments'})).toEqual({type:'email',value:'info@domaine.example',label:'Appointments',note:null});
    expect(normalizeManualProducerContact({type:'website',value:'domaine.example/contact'}).value).toBe('https://domaine.example/contact');
    expect(normalizeManualProducerContact({type:'instagram',value:'instagram.com/domaine.example'}).value).toBe('https://instagram.com/domaine.example');
  });

  it('rejects invalid contact values conservatively',()=>{
    expect(()=>normalizeManualProducerContact({type:'email',value:'not-an-email'})).toThrow(/valid email/i);
    expect(()=>normalizeManualProducerContact({type:'phone',value:'123'})).toThrow(/valid phone/i);
    expect(()=>normalizeManualProducerContact({type:'instagram',value:'example.com/domaine'})).toThrow(/instagram\.com/i);
  });

  it('collapses exact supplementary duplicates while preserving different labels',()=>{
    const base={type:'email' as const,value:'info@example.com',note:null,createdAt:'2026-01-01',updatedAt:'2026-01-01'};
    const rows=[
      {id:'destination',label:'Appointments',...base},
      {id:'merged-copy',label:'Appointments',...base},
      {id:'winemaker',label:'Winemaker',...base}
    ];
    expect(dedupeManualProducerContacts(rows).map(row=>row.id)).toEqual(['destination','winemaker']);
  });
});
