// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter,useLocation } from 'react-router-dom';
import { afterEach,describe,expect,it } from 'vitest';
import { useBaseline } from '../../src/features/vintages/useVintages';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let seen:{value:string;search:string;set:(next:'standard'|'era')=>void}|null=null;
function Probe(){const [value,set]=useBaseline();const {search}=useLocation();seen={value,search,set};return null}
const container=document.createElement('div');let root:ReturnType<typeof createRoot>|null=null;
function render(url:string){root=createRoot(container);act(()=>root!.render(<MemoryRouter initialEntries={[url]}><Probe/></MemoryRouter>))}
afterEach(()=>{act(()=>root?.unmount());root=null;seen=null});

describe('vintage comparison baseline',()=>{
  it('starts on 1991–2020 even after an earlier visit chose its own era',()=>{
    render('/vintages');
    act(()=>seen!.set('era'));
    expect(seen!.value).toBe('era');
    expect(seen!.search).toBe('?baseline=era');
    act(()=>root!.unmount());
    render('/vintages');
    expect(seen!.value).toBe('standard');
  });
  it('keeps its own era from a shared link',()=>{
    render('/vintages/meursault/1961?baseline=era');
    expect(seen!.value).toBe('era');
  });
});
