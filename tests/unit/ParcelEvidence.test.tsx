// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
import {ParcelEvidence} from '../../src/features/vineyards/ParcelEvidence';
import evidence from '../../src/lib/places/echezeauxParcelEvidence.json';

const id=(ref:string)=>`212670000D${ref.padStart(4,'0')}`;
afterEach(()=>{cleanup();vi.resetModules();vi.doUnmock('../../src/lib/places/echezeauxParcelEvidence.json')});

describe('Parcel evidence panel',()=>{
 it('lists an authorisation as a dated notice with its caveat and a source link, and folds weak leads',async()=>{
  render(<ParcelEvidence parcelId={id('665')}/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getByText('Dated records about this parcel. They show notices, owners and published research, not who farms it today.')).toBeTruthy();
  expect(within(panel).getByText('Authorisation decision')).toBeTruthy();
  expect(within(panel).getByText('4 Jul 2022').getAttribute('datetime')).toBe('2022-07-04');
  expect(within(panel).getByText('Previously farmed by Domaine Daniel Rion et Fils')).toBeTruthy();
  expect(within(panel).getByRole('link',{name:/Official notice/}).getAttribute('href')).toContain('recueil-bfc-2022-084');
  const leads=panel.querySelector('details.parcel-evidence-leads') as HTMLDetailsElement;
  expect(leads.open).toBe(false);
  expect(within(leads).getByText(/not evidence of who farms/)).toBeTruthy();
 });
 it('shows a suspended application as procedural and keeps it off any farming claim',async()=>{
  render(<ParcelEvidence parcelId={id('673')}/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getByText('Application suspended')).toBeTruthy();
  expect(within(panel).getByText(/Not an authorisation/)).toBeTruthy();
  expect(within(panel).getByText('1 Jan 2025')).toBeTruthy();  // owner snapshot, not an operating date
  expect(within(panel).getByText('Recorded owner changed to Bouchon Pourpre')).toBeTruthy();
 });
 it('labels evidence inherited through a divided parcel and keeps directly named references distinct',async()=>{
  render(<ParcelEvidence parcelId={id('826')}/>);
  const panel=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(panel).getAllByText('Inherited from former parcel D0792').length).toBeGreaterThan(0);
  expect(within(panel).getByText('Created by dividing D0792')).toBeTruthy();
  cleanup();
  render(<ParcelEvidence parcelId={id('172')}/>);
  const direct=await screen.findByRole('region',{name:'History and evidence'});
  expect(within(direct).queryByText(/Inherited from former parcel/)).toBeNull();
  expect(within(direct).getByText('Named by parcel number')).toBeTruthy();
 });
 it('covers a Grands-Échezeaux parcel named in a notice',async()=>{
  render(<ParcelEvidence parcelId={id('93')}/>);
  expect(within(await screen.findByRole('region',{name:'History and evidence'})).getByText('Application received')).toBeTruthy();
 });
 it('says only that no dated records were found, never that nobody farms the parcel',async()=>{
  expect(evidence.parcels).not.toHaveProperty(id('1'));
  render(<ParcelEvidence parcelId={id('1')}/>);
  expect(await screen.findByText('No dated records were found for this parcel. This does not mean nobody farms it.')).toBeTruthy();
 });
 it('reports a failed load and recovers on retry',async()=>{
  vi.resetModules();
  vi.doMock('../../src/lib/places/echezeauxParcelEvidence.json',()=>{throw new Error('offline')});
  const {ParcelEvidence:Fresh}=await import('../../src/features/vineyards/ParcelEvidence');
  render(<Fresh parcelId={id('665')}/>);
  expect((await screen.findByRole('alert')).textContent).toContain('Evidence records could not load');
  vi.doUnmock('../../src/lib/places/echezeauxParcelEvidence.json');
  vi.resetModules();
  const {ParcelEvidence:Again}=await import('../../src/features/vineyards/ParcelEvidence');
  cleanup();
  render(<Again parcelId={id('665')}/>);
  expect(await screen.findByRole('region',{name:'History and evidence'})).toBeTruthy();
 });
});
