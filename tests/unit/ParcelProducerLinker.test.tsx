// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ParcelProducerLinker} from '../../src/features/vineyards/ParcelProducerLinker';
import {listProducers} from '../../src/features/producers/api';
import {listParcelProducerLinks,saveParcelProducerLink,removeParcelProducerLink} from '../../src/features/vineyards/parcelProducerApi';

vi.mock('../../src/features/producers/api',()=>({listProducers:vi.fn()}));
vi.mock('../../src/features/vineyards/parcelProducerApi',()=>({listParcelProducerLinks:vi.fn(),saveParcelProducerLink:vi.fn(),removeParcelProducerLink:vi.fn()}));
const holder={id:'397738634',name:'NICOLE LAMARCHE'};
const link={holderId:holder.id,producerId:'nicole',producerName:'Domaine Nicole Lamarche',status:'manual' as const,updatedAt:'2026-09-28'};
const producers={items:[{id:'nicole',canonicalName:'Domaine Nicole Lamarche',homeCountry:'France',homeRegion:'Burgundy',homeLocality:'Vosne-Romanée',tastedCount:1,catalogCount:1,researchedAt:null}]};
afterEach(()=>{cleanup();vi.resetAllMocks()});
describe('parcel producer catalogue linking',()=>{
 it('opens a searchable explicit choice, saves and navigates to the actual producer',async()=>{
  vi.mocked(listParcelProducerLinks).mockResolvedValue({items:[]});vi.mocked(listProducers).mockResolvedValue(producers);vi.mocked(saveParcelProducerLink).mockResolvedValue(link);
  const onEdit=vi.fn();
  render(<ParcelProducerLinker parentId="inao-denom-565" holders={[holder]} editing={holder.id} onEdit={onEdit} onShow={vi.fn()}/>);
  const select=await screen.findByRole('combobox',{name:'App producer'});
  expect(select).toHaveProperty('value','');
  fireEvent.change(screen.getByLabelText('Search app producers'),{target:{value:'Nicole'}});
  fireEvent.change(select,{target:{value:'nicole'}});
  fireEvent.click(screen.getByRole('button',{name:'Save producer link'}));
  await screen.findByText('Manual link · unverified');
  expect(saveParcelProducerLink).toHaveBeenCalledWith('inao-denom-565',holder.id,'nicole');
  expect(screen.getByRole('link',{name:'Domaine Nicole Lamarche'}).getAttribute('href')).toBe('/producers/nicole');
  expect(onEdit).toHaveBeenCalledWith('');
 });
 it('loads saved links without fetching the catalogue, and supports highlight, change and removal',async()=>{
  vi.mocked(listParcelProducerLinks).mockResolvedValue({items:[link]});vi.mocked(removeParcelProducerLink).mockResolvedValue({deleted:true});
  const onEdit=vi.fn(),onShow=vi.fn();
  render(<ParcelProducerLinker parentId="inao-denom-565" holders={[holder]} editing="" onEdit={onEdit} onShow={onShow}/>);
  await screen.findByRole('link');expect(listProducers).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Show on map'}));expect(onShow).toHaveBeenCalledWith(holder.id);
  fireEvent.click(screen.getByRole('button',{name:'Change link'}));expect(onEdit).toHaveBeenCalledWith(holder.id);
  fireEvent.click(screen.getByRole('button',{name:'Remove link'}));
  await waitFor(()=>expect(screen.queryByRole('link')).toBeNull());
 });
 it('keeps failed saves editable and retries catalogue and link downloads',async()=>{
  vi.mocked(listParcelProducerLinks).mockRejectedValueOnce(new Error()).mockResolvedValue({items:[]});
  vi.mocked(listProducers).mockRejectedValueOnce(new Error()).mockResolvedValue(producers);
  vi.mocked(saveParcelProducerLink).mockRejectedValueOnce(new Error('Try saving again')).mockResolvedValue(link);
  render(<ParcelProducerLinker parentId="inao-denom-565" holders={[holder]} editing={holder.id} onEdit={vi.fn()} onShow={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Retry producer links'}));
  fireEvent.click(await screen.findByRole('button',{name:'Retry catalogue'}));
  fireEvent.change(await screen.findByRole('combobox'),{target:{value:'nicole'}});
  fireEvent.click(screen.getByRole('button',{name:'Save producer link'}));
  await screen.findByText('Try saving again');
  expect(screen.getByRole('combobox')).toHaveProperty('value','nicole');
  fireEvent.click(screen.getByRole('button',{name:'Save producer link'}));
  await screen.findByText('Manual link · unverified');
 });
});
