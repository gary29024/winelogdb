// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ProducerLinkCard} from '../../src/features/vineyards/ParcelProducerLinker';
import {useParcelProducerLinks} from '../../src/features/vineyards/useParcelProducerLinks';
import {listProducers} from '../../src/features/producers/api';
import {listParcelProducerLinks,saveParcelProducerLink,removeParcelProducerLink} from '../../src/features/vineyards/parcelProducerApi';
import type {HolderGroup} from '../../src/lib/places/parcelPresentation';
import type {ParcelProducerLink} from '../../src/lib/places/parcelProducerLinks';

vi.mock('../../src/features/producers/api',()=>({listProducers:vi.fn()}));
vi.mock('../../src/features/vineyards/parcelProducerApi',()=>({listParcelProducerLinks:vi.fn(),saveParcelProducerLink:vi.fn(),removeParcelProducerLink:vi.fn()}));
const row=(id:string,name:string,holderIds:string[],legalNames:string[]):HolderGroup=>({id,name,domaine:true,holderIds,legalNames,areaM2:11000,count:3,sources:[],basisLabel:''});
const nicole=row('domaine:nicole','Domaine Nicole Lamarche',['397738634'],['Nicole Lamarche']);
const family=row('domaine:family','Domaine Family Estate',['a','b'],['GFA Family A','SCEA Family B']);
const link=(holderId:string,producerId='nicole',producerName='Domaine Nicole Lamarche'):ParcelProducerLink=>({holderId,producerId,producerName,status:'manual',updatedAt:'2026-10-08'});
function Card({parentId='inao-denom-565',producer='Domaine Nicole Lamarche',producerId='nicole' as string|null,rows=[nicole,family],onShow=vi.fn()}){
 const links=useParcelProducerLinks(parentId,producer,producerId);
 return <ProducerLinkCard producer={producer} rows={rows} links={links} onShow={onShow}/>;
}
const saveEcho=()=>vi.mocked(saveParcelProducerLink).mockImplementation(async(_parent,holderId,producerId)=>link(holderId,producerId));
afterEach(()=>{cleanup();vi.resetAllMocks()});
describe('one-tap parcel producer links',()=>{
 it('links a suggested row to the wine’s own producer without asking for a catalogue choice',async()=>{
  vi.mocked(listParcelProducerLinks).mockResolvedValue({items:[]});saveEcho();
  const onShow=vi.fn();
  render(<Card onShow={onShow}/>);
  expect((await screen.findByText(/Looks like/)).textContent).toBe('Looks like Domaine Nicole Lamarche · 1.10 ha');
  // A name match is only offered, never saved until tapped.
  expect(saveParcelProducerLink).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Link Domaine Nicole Lamarche to Domaine Nicole Lamarche'}));
  await screen.findByText('Manual link · unverified');
  expect(saveParcelProducerLink).toHaveBeenCalledWith('inao-denom-565','397738634','nicole');
  expect(screen.getByText(/Linked to/).textContent).toBe('Linked to Domaine Nicole Lamarche · 1.10 ha');
  expect(onShow).toHaveBeenCalledWith(nicole);
  expect(listProducers).not.toHaveBeenCalled();
  expect(screen.queryByRole('combobox')).toBeNull();
 });
 it('saves one link per company in a domaine row and unlinks them together',async()=>{
  vi.mocked(listParcelProducerLinks).mockResolvedValue({items:[]});saveEcho();vi.mocked(removeParcelProducerLink).mockResolvedValue({deleted:true});
  function Rows(){
   const links=useParcelProducerLinks('inao-denom-565','Domaine Nicole Lamarche','nicole');
   return <><ProducerLinkCard producer="Domaine Nicole Lamarche" rows={[family]} links={links} onShow={vi.fn()}/>
    <button type="button" onClick={()=>void links.link(family)}>Link family</button></>;
  }
  render(<Rows/>);
  expect(await screen.findByText('Not linked to any parcels yet.')).toBeTruthy();
  expect(screen.queryByText(/Looks like/)).toBeNull();
  expect(screen.getByText('Choose its row in the list below to link it.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Link family'}));
  await screen.findByText(/Linked to/);
  expect(vi.mocked(saveParcelProducerLink).mock.calls).toEqual([['inao-denom-565','a','nicole'],['inao-denom-565','b','nicole']]);
  fireEvent.click(screen.getByRole('button',{name:'Unlink Domaine Family Estate'}));
  expect(await screen.findByText('Not linked to any parcels yet.')).toBeTruthy();
  expect(vi.mocked(removeParcelProducerLink).mock.calls).toEqual([['inao-denom-565','a'],['inao-denom-565','b']]);
 });
 it('shows only this producer’s links and offers nothing to link without a catalogue producer',async()=>{
  vi.mocked(listParcelProducerLinks).mockResolvedValue({items:[link('397738634','millot','Jean-Marc Millot')]});
  const view=render(<Card producer="Jean-Marc Millot" producerId={null}/>);
  await waitFor(()=>expect(listParcelProducerLinks).toHaveBeenCalled());
  // The saved link matches by name, so it shows even without a catalogue ID, but nothing new can be linked.
  expect(await screen.findByText(/Linked to/)).toBeTruthy();
  expect(screen.queryByText('Not linked to any parcels yet.')).toBeNull();
  view.unmount();
  render(<Card producer="Domaine Leroy" producerId={null}/>);
  await waitFor(()=>expect(listParcelProducerLinks).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('region',{name:'This wine’s producer'})).toBeNull();
 });
 it('keeps a failed save visible and retries a failed download',async()=>{
  vi.mocked(listParcelProducerLinks).mockRejectedValueOnce(new Error()).mockResolvedValue({items:[]});
  vi.mocked(saveParcelProducerLink).mockRejectedValueOnce(new Error('Try saving again'));
  render(<Card/>);
  fireEvent.click(await screen.findByRole('button',{name:'Retry producer links'}));
  fireEvent.click(await screen.findByRole('button',{name:'Link Domaine Nicole Lamarche to Domaine Nicole Lamarche'}));
  expect(await screen.findByText('Try saving again')).toBeTruthy();
  expect(screen.getByText('Not linked to any parcels yet.')).toBeTruthy();
 });
 it('ignores a stale response from another cru and keeps exact-ID links after a producer rename',async()=>{
  let resolve!:(value:{items:ParcelProducerLink[]})=>void;
  vi.mocked(listParcelProducerLinks).mockReturnValueOnce(new Promise(done=>{resolve=done})).mockResolvedValue({items:[]});
  const view=render(<Card parentId="old"/>);
  view.rerender(<Card parentId="new" producer="Jean-Marc Millot" producerId="millot"/>);
  await act(async()=>resolve({items:[link('397738634')]}));
  expect(screen.queryByText(/Linked to/)).toBeNull();
  vi.mocked(listParcelProducerLinks).mockResolvedValue({items:[link('397738634')]});
  view.rerender(<Card parentId="renamed" producer="A renamed catalogue producer" producerId="nicole"/>);
  expect(await screen.findByText(/Linked to/)).toBeTruthy();
 });
});
