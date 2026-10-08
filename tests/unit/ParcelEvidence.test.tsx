// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {ParcelEvidence} from '../../src/features/vineyards/ParcelEvidence';
import evidence from '../../src/lib/places/grandCruParcels/echezeaux.evidence.json';

const id=(ref:string)=>`212670000D${ref.padStart(4,'0')}`;
const fresh=async()=>{vi.resetModules();return (await import('../../src/features/vineyards/ParcelEvidence')).ParcelEvidence};
afterEach(()=>{cleanup();vi.resetModules();vi.doUnmock('../../src/lib/places/grandCruParcels/echezeaux.evidence.json')});

describe('Parcel evidence panel',()=>{
 it('opens only the first group, lets the reader open or close any group and remembers that on the next parcel',async()=>{
  const Fresh=await fresh();
  const {rerender}=render(<Fresh parcelId={id('665')} parentId="inao-denom-565"/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  const groups=()=>[...panel.querySelectorAll('details.parcel-evidence-group')] as HTMLDetailsElement[];
  expect(groups().map(g=>g.open)).toEqual(groups().map((_,i)=>i===0));
  expect(groups().length).toBeGreaterThan(1);
  fireEvent.click(groups()[1].querySelector('summary')!);
  expect(groups()[1].open).toBe(true);
  fireEvent.click(groups()[0].querySelector('summary')!);
  expect(groups()[0].open).toBe(false);
  rerender(<Fresh parcelId={id('673')} parentId="inao-denom-565"/>);
  const next=[...(await screen.findByRole('region',{name:'History and evidence'})).querySelectorAll('details.parcel-evidence-group')] as HTMLDetailsElement[];
  expect(next.find(g=>g.classList.contains('parcel-evidence-notices'))?.open).toBe(false);
 });
 it('opens the weak leads when they are the only records for a parcel',async()=>{
  const only=Object.entries(evidence.parcels as Record<string,{kind:string}[]>).find(([,items])=>items.every(i=>i.kind==='lead'));
  if(!only)return;
  const Fresh=await fresh();
  render(<Fresh parcelId={only[0]} parentId="inao-denom-565"/>);
  const leads=(await screen.findByRole('region',{name:'History and evidence'})).querySelector('details.parcel-evidence-leads') as HTMLDetailsElement;
  expect(leads.open).toBe(true);
 });
 it('lists an authorisation as a dated notice with its caveat and a source link, and folds weak leads',async()=>{
  render(<ParcelEvidence parcelId={id('665')} parentId="inao-denom-565"/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).queryByText(/Dated notices, recorded rights/)).toBeNull();
  expect(within(panel).getByText('Authorisation decision')).toBeTruthy();
  expect(within(panel).getByText('4 Jul 2022').getAttribute('datetime')).toBe('2022-07-04');
  expect(within(panel).getByText('Previous operator named in notice: Domaine Daniel Rion et Fils')).toBeTruthy();
  expect(within(panel).getByRole('link',{name:/Official notice/}).getAttribute('href')).toContain('recueil-bfc-2022-084');
  const leads=panel.querySelector('details.parcel-evidence-leads') as HTMLDetailsElement;
  expect(leads.open).toBe(false);
  expect(within(leads).queryByText(/context only/)).toBeNull();
 });
 it('shows a suspended application as procedural and keeps it off any farming claim',async()=>{
  render(<ParcelEvidence parcelId={id('673')} parentId="inao-denom-565"/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getByText('Application suspended')).toBeTruthy();
  expect(within(panel).getByText(/Not an authorisation/)).toBeTruthy();
  expect(within(panel).getByText('1 Jan 2025')).toBeTruthy();  // rights snapshot, not an operating date
  expect(within(panel).getByText('Recorded right holder changed to Bouchon Pourpre')).toBeTruthy();
 });
 it('labels former-reference context and spatial inference without claiming creation or inheritance',async()=>{
  render(<ParcelEvidence parcelId={id('826')} parentId="inao-denom-565"/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getAllByText('Record names former parcel D0792').length).toBeGreaterThan(0);
  expect(within(panel).getByText('Spatial inference from former parcel D0792')).toBeTruthy();
  expect(within(panel).queryByText(/Created by dividing/)).toBeNull();
  cleanup();
  render(<ParcelEvidence parcelId={id('172')} parentId="inao-denom-565"/>);
  const direct=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(direct).getByText('Named by parcel number')).toBeTruthy();
 });
 it('shows a co-sale and a later company holder without identifying the buyer',async()=>{
  render(<ParcelEvidence parcelId={id('146')} parentId="inao-denom-565"/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getByText('Sale record')).toBeTruthy();
  expect(within(panel).getByText('14 Mar 2024').getAttribute('datetime')).toBe('2024-03-14');
  expect(within(panel).getByText(/Other parcels were later recorded to Les Cruots\. That later record does not identify the buyer of this parcel\./)).toBeTruthy();
  expect(within(panel).getByText(/no buyer, seller or price/)).toBeTruthy();
  expect(within(panel).getByRole('link',{name:/DVF\+ open-data/}).getAttribute('href')).toContain('dvfplus');
 });
 it('shows an exact-area match with the farming domaine as published research, undated',async()=>{
  render(<ParcelEvidence parcelId={id('362')} parentId="inao-denom-565"/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getByText('Matched by exact area')).toBeTruthy();
  expect(within(panel).getByText('Gérard Mugneret, Les Quartiers de Nuits (métayage)')).toBeTruthy();
  expect(within(panel).getByText(/sharecrops 0\.6462 ha/)).toBeTruthy();
 });
 it('shows the deed date and individual partial tenancy separately from historical research',async()=>{
  const Fresh=await fresh();
  render(<Fresh parcelId={id('316')} parentId="inao-denom-565"/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  const filings=panel.querySelector('details.parcel-evidence-filings') as HTMLDetailsElement;
  expect(filings.open).toBe(true);
  expect(within(filings).getByText('9 Feb 2024').getAttribute('datetime')).toBe('2024-02-09');
  expect(within(filings).getByText(/Laurent Jousset-Drouhin personally as tenant of 726 m² of this 826 m² parcel/)).toBeTruthy();
  expect(within(filings).getByRole('link',{name:/ORVEAUX: founding deed/}).getAttribute('href')).toContain('12-02-2024.pdf');
  const research=panel.querySelector<HTMLElement>('details.parcel-evidence-research')!;
  expect(research.querySelector('time')).toBeNull();
  expect(within(research).getByText(/Guide Hachette 2001 \(1998 vintage\)/)).toBeTruthy();
 });
 it('labels the historical Vigot figure as a near-area reconstruction',async()=>{
  render(<ParcelEvidence parcelId={id('195')} parentId="inao-denom-565"/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getByText('Near-area reconstruction')).toBeTruthy();
  expect(within(panel).queryByText('Matched by exact area')).toBeNull();
  expect(within(panel).getByText(/5963 m²; this parcel is 5965 m² cadastral/)).toBeTruthy();
 });
 it('covers a Grands-Échezeaux parcel named in a notice, through the cru registry',async()=>{
  render(<ParcelEvidence parcelId={id('93')} parentId="inao-denom-645"/>);
  expect(within(await screen.findByRole('region',{name:'History and evidence'})).getByText('Application received')).toBeTruthy();
 });
 it('labels the Vougeot bare-ownership snapshot as recorded rights and does not identify a farmer',async()=>{
  render(<ParcelEvidence parcelId="217160000A0005" parentId="inao-denom-546"/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getByText('Rights record')).toBeTruthy();
  expect(within(panel).getByText('Legal-entity right first observed in these snapshots: Anne Gros')).toBeTruthy();
  expect(within(panel).getByText(/Rights and sales/)).toBeTruthy();
  expect(within(panel).queryByText('Ownership record')).toBeNull();
  expect(within(panel).queryByText('Verified operator')).toBeNull();
 });
 it('qualifies an unmatched reference against the reviewed sources',async()=>{
  expect(evidence.parcels).not.toHaveProperty(id('1'));
  render(<ParcelEvidence parcelId={id('1')} parentId="inao-denom-565"/>);
  expect(await screen.findByText('No matched records in the reviewed sources for this parcel.')).toBeTruthy();
 });
 it('shows the 1991 DFI validation and whole event group, without the research tracing notes',async()=>{
  const Fresh=await fresh();
  render(<Fresh parcelId={id('736')} parentId="inao-denom-565"/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getByText('Official event group: D0327 → D0736, D0737')).toBeTruthy();
  expect(within(panel).getAllByText('22 Jan 1991').every(t=>t.getAttribute('datetime')==='1991-01-22')).toBe(true);
  expect(within(panel).getAllByText('DFI validation date').length).toBeGreaterThan(0);
  // Source coverage and tracing stay in the research files, not in the reader's panel.
  expect(within(panel).queryByText('Source coverage and tracing')).toBeNull();
  expect(within(panel).queryByText(/Earliest supported event:|No earlier correspondence in the obtained DFI file/)).toBeNull();
  expect(within(panel).getByRole('link',{name:/DGFiP official DFI/}).getAttribute('href')).toContain('juillet_2026');
  expect(within(panel).queryByText(/Created by/)).toBeNull();
 });
 it('shows each former record’s original scope and whether a route is official or inferred',async()=>{
  const Fresh=await fresh();
  const {unmount}=render(<Fresh parcelId={id('898')} parentId="inao-denom-565"/>);
  let panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getAllByText('Scope: the whole former parcel as recorded').length).toBeGreaterThan(0);
  expect(within(panel).getAllByText(/^Official DGFiP filiation record: /).length).toBeGreaterThan(0);
  unmount();
  render(<Fresh parcelId="217160000A0581" parentId="inao-denom-546"/>);
  panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getAllByText('Scope: every parcel in the deed together').length).toBeGreaterThan(0);
  cleanup();
  render(<Fresh parcelId={id('818')} parentId="inao-denom-565"/>);
  panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getAllByText('Inferred from map overlap, not an official record').length).toBeGreaterThan(0);
 });
 it('retains the outside-cru daughter in the verified 1989 Vougeot event',async()=>{
  const Fresh=await fresh();
  render(<Fresh parcelId="217160000A0408" parentId="inao-denom-546"/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getByText('Official event group: A0022 → A0408, A0409, A0410')).toBeTruthy();
  expect(within(panel).getAllByText('20 Apr 1989').every(t=>t.getAttribute('datetime')==='1989-04-20')).toBe(true);
  expect(within(panel).queryByText('Verified operator')).toBeNull();
 });
 it('reports a failed load and recovers on retry',async()=>{
  vi.resetModules();
  vi.doMock('../../src/lib/places/grandCruParcels/echezeaux.evidence.json',()=>{throw new Error('offline')});
  const {ParcelEvidence:Fresh}=await import('../../src/features/vineyards/ParcelEvidence');
  render(<Fresh parcelId={id('665')} parentId="inao-denom-565"/>);
  expect((await screen.findByRole('alert')).textContent).toContain('Evidence records could not load');
  vi.doUnmock('../../src/lib/places/grandCruParcels/echezeaux.evidence.json');
  vi.resetModules();
  const {ParcelEvidence:Again}=await import('../../src/features/vineyards/ParcelEvidence');
  cleanup();
  render(<Again parcelId={id('665')} parentId="inao-denom-565"/>);
  expect(await screen.findByRole('region',{name:'History and evidence'})).toBeTruthy();
 });
});
