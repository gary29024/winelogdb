import { createD1Stub } from './support/d1Stub';
import { describe,expect,it } from 'vitest';
import { updateManualProducerContact,dedupeManualProducerContacts,normalizeManualProducerContact } from '../../src/lib/producers/manualContacts';

describe('producer supplementary contacts',()=>{
  it.each([undefined,'WRONG'])('requires explicit promotion confirmation before writing (%s)',async confirmation=>{
    const stub=createD1Stub(sql=>sql.includes('FROM producer_manual_contacts')?{first:{id:'c1',contact_type:'website',value:'https://new.example/',created_at:'2026-01-01'}}:undefined);
    await expect(updateManualProducerContact(stub.db,'owner','p1','c1',{type:'website',value:'https://new.example/',official:true,confirmation})).rejects.toThrow('explicit confirmation');
    expect(stub.writes()).toHaveLength(0);
  });

  it('promotes with confirmation and removes the supplementary row in one batch',async()=>{
    const stub=createD1Stub(sql=>sql.includes('FROM producer_manual_contacts')?{first:{id:'c1',contact_type:'website',value:'https://new.example/',created_at:'2026-01-01'}}:sql.includes('SELECT contact_sources_json')?{first:{contact_sources_json:'[]'}}:undefined);
    await updateManualProducerContact(stub.db,'owner','p1','c1',{type:'website',value:'https://new.example/',official:true,confirmation:'CONFIRM_OFFICIAL_CONTACT'});
    expect(stub.writes()).toHaveLength(2);
    expect(stub.writes()[0].args[0]).toBe('https://new.example/');
    expect(stub.writes()[1].sql).toContain('DELETE FROM producer_manual_contacts');
  });

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
