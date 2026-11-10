// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Layout } from '../../src/components/Layout';
import { PageSkeleton } from '../../src/components/PageSkeleton';
import { dismissToast, showToast } from '../../src/components/toast';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function render(path: string, page = <p>Page</p>) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={page} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  });
  return host;
}
const click = (element: Element) =>
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

afterEach(() => {
  act(() => dismissToast());
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.useRealTimers();
});

describe('the More tab', () => {
  it('opens a sheet with the places that have no tab on a phone', () => {
    const trigger = render('/').querySelector<HTMLButtonElement>('.mobile-nav .more-nav')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const sheet = document.querySelector('[role=dialog]')!;
    expect(document.activeElement).toBe(sheet);
    const links = [...sheet.querySelectorAll('.more-sheet-links a')];
    expect(links.map((link) => link.querySelector('strong')?.textContent)).toEqual([
      'Tastings',
      'Vintages',
      'Cellar',
      'Achievements',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/tastings',
      '/vintages',
      '/journal?scope=cellar',
      '/achievements',
    ]);
  });

  it('closes when a place is chosen, and on Escape', () => {
    const shell = render('/');
    const trigger = shell.querySelector<HTMLButtonElement>('.mobile-nav .more-nav')!;
    click(trigger);
    click(document.querySelector('.more-sheet-links a')!);
    expect(document.querySelector('[role=dialog]')).toBeNull();
    click(trigger);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('never shows the scan sheet and the More sheet together', () => {
    const shell = render('/');
    click(shell.querySelector('.mobile-nav .more-nav')!);
    click(shell.querySelector('.mobile-nav .scan-nav')!);
    expect(document.querySelectorAll('[role=dialog]')).toHaveLength(1);
    expect(document.querySelector('#scan-sheet-title')).toBeTruthy();
  });

  it.each(['/tastings', '/tastings/abc', '/vintages/2020', '/achievements', '/journal?scope=cellar'])(
    'is marked as the current tab on %s',
    (path) => {
      expect(render(path).querySelector('.mobile-nav .more-nav')!.className).toContain('is-current');
    },
  );

  it.each(['/', '/journal', '/producers'])('is not marked as current on %s', (path) => {
    expect(render(path).querySelector('.mobile-nav .more-nav')!.className).not.toContain('is-current');
  });
});

describe('confirmations', () => {
  it('shows a message that survives the page changing, then clears itself', () => {
    vi.useFakeTimers();
    const shell = render('/');
    const region = shell.querySelector('.toast-host')!;
    expect(region.getAttribute('aria-live')).toBe('polite');
    // Pages own role="status" for their notices; the confirmation must not add a second one.
    expect(shell.querySelectorAll('[role=status]')).toHaveLength(0);
    expect(region.textContent).toBe('');
    act(() => showToast('Wine saved'));
    expect(region.textContent).toBe('Wine saved');
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(region.textContent).toBe('');
  });

  it('replaces an earlier message rather than stacking them', () => {
    const region = render('/').querySelector('.toast-host')!;
    act(() => showToast('Wine saved'));
    act(() => showToast('Wine deleted'));
    expect(region.querySelectorAll('.toast')).toHaveLength(1);
    expect(region.textContent).toBe('Wine deleted');
  });
});

describe('loading placeholders', () => {
  it('keep the sentence for screen readers while drawing shapes instead of text', () => {
    const page = render('/', <PageSkeleton label="Loading wine…" />).querySelector('.page-skeleton')!;
    expect(page.getAttribute('aria-live')).toBe('polite');
    expect(page.querySelector('.skeleton-label')?.textContent).toBe('Loading wine…');
    expect(page.querySelectorAll('.skeleton-block').length).toBeGreaterThan(3);
  });

  it('draws rows for a list page', () => {
    const page = render('/', <PageSkeleton label="Loading producers…" shape="list" />);
    expect(page.querySelectorAll('.skeleton-row')).toHaveLength(5);
  });
});
