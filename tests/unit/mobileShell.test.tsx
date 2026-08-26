// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,describe,expect,it } from 'vitest';
import { Layout } from '../../src/components/Layout';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const shellCss=readFileSync(resolve(process.cwd(),'src/mobileShell.css'),'utf8');

let root:Root|null=null,host:HTMLDivElement|null=null;

function renderShell(){
  host=document.createElement('div');
  document.body.appendChild(host);
  root=createRoot(host);
  act(()=>{root!.render(<MemoryRouter initialEntries={['/']}><Routes><Route element={<Layout/>}><Route index element={<p>Passport page</p>}/></Route></Routes></MemoryRouter>)});
  return host;
}

const click=(element:Element)=>act(()=>{element.dispatchEvent(new MouseEvent('click',{bubbles:true}))});
const pressEscape=()=>act(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))});
const labelled=(scope:Element,text:string)=>[...scope.querySelectorAll('a,button')].find(element=>element.textContent?.includes(text));

afterEach(()=>{
  act(()=>root?.unmount());
  host?.remove();
  root=null;host=null;
});

describe('mobile shell',()=>{
  it('labels every tab and draws it with an icon instead of a text glyph',()=>{
    const nav=renderShell().querySelector('.mobile-nav')!;
    const tabs=['Passport','Journal','Scan Wine','Producers','Insights'];
    for(const label of tabs)expect(labelled(nav,label)?.querySelector('svg.app-icon')).toBeTruthy();
    expect(nav.textContent).toBe(tabs.join(''));
  });

  it('opens the add-wine sheet from the tab bar and reports its state to assistive tech',()=>{
    const shell=renderShell();
    const trigger=shell.querySelector('.mobile-nav .scan-nav')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const sheet=document.querySelector('[role=dialog]')!;
    expect(document.activeElement).toBe(sheet);
    // The page behind a modal sheet must not scroll with it.
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes the sheet on Escape and hands focus back to the tab that opened it',()=>{
    const shell=renderShell();
    const trigger=shell.querySelector<HTMLButtonElement>('.mobile-nav .scan-nav')!;
    click(trigger);
    pressEscape();
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
  });

  it('sends every capture route to its own page, Single Wine included',()=>{
    // Single Wine used to open the OS file chooser straight from the sheet,
    // while the other two navigated - so it skipped the page that explains what
    // it does and what it will use the photos for. The hidden input that made
    // that possible is gone with it.
    host=document.createElement('div');document.body.appendChild(host);
    root=createRoot(host);
    act(()=>{root!.render(<MemoryRouter initialEntries={['/']}><Routes><Route element={<Layout/>}>
      <Route index element={<p>Passport page</p>}/>
      <Route path="upload" element={<p>Single wine page</p>}/>
    </Route></Routes></MemoryRouter>)});
    expect(host.querySelector('input[type=file]')).toBeNull();
    click(host.querySelector('.mobile-nav .scan-nav')!);
    click(labelled(document.querySelector('[role=dialog]')!,'Single Wine')!);
    expect(host.textContent).toContain('Single wine page');
  });

  it('offers all three capture routes plus a manual fallback',()=>{
    const shell=renderShell();
    click(shell.querySelector('.mobile-nav .scan-nav')!);
    const sheet=document.querySelector('[role=dialog]')!;
    for(const action of ['Single Wine','Group Photo','Batch Scan','Add manually instead']){
      expect(labelled(sheet,action)?.querySelector('svg.app-icon')).toBeTruthy();
    }
  });
});

describe('iPhone safe-area fit',()=>{
  it('reserves the status-bar inset above the sticky header',()=>{
    expect(shellCss).toContain('--app-safe-top:env(safe-area-inset-top,0px)');
    expect(shellCss).toMatch(/\.topbar\{[^}]*padding-top:var\(--app-safe-top\)/);
  });

  it('sizes the tab bar and the page bottom around the home indicator',()=>{
    expect(shellCss).toContain('--app-nav-height:calc(var(--app-nav-block) + var(--app-safe-bottom))');
    expect(shellCss).toMatch(/\.mobile-nav\{[^}]*height:var\(--app-nav-height\)/);
    expect(shellCss).toMatch(/main\{padding:[^}]*var\(--app-nav-height\)/);
  });

  it('keeps content clear of the notch when the phone is on its side',()=>{
    expect(shellCss).toContain('--app-safe-left:env(safe-area-inset-left,0px)');
    expect(shellCss).toMatch(/main\{padding:[^}]*max\(var\(--app-gutter\),var\(--app-safe-left\)\)/);
  });

  it('keeps form controls at 16px so iOS does not zoom the viewport on focus',()=>{
    expect(shellCss).toMatch(/input:not\(\[type=checkbox\]\)[^{]*\{font-size:max\(16px,1em\)\}/);
  });
});
