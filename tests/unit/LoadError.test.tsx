// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadError } from '../../src/components/LoadError';
import { loadFailureReason } from '../../src/components/loadFailureReason';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('loadFailureReason', () => {
  it('explains a dropped connection instead of repeating the browser error', () => {
    expect(loadFailureReason(new TypeError('Failed to fetch'), 'Fallback')).toMatch(
      /offline or the connection dropped/,
    );
    expect(loadFailureReason(new TypeError('Load failed'), 'Fallback')).toMatch(/offline or the connection dropped/);
  });
  it('says so when the device reports it is offline, whatever was thrown', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(loadFailureReason(new Error('Wine not found'), 'Fallback')).toMatch(/offline or the connection dropped/);
  });
  it('keeps a plain server message and falls back when there is none', () => {
    expect(loadFailureReason(new Error('Session expired. Please sign in again.'), 'Fallback')).toBe(
      'Session expired. Please sign in again.',
    );
    expect(loadFailureReason('Wine not found', 'Fallback')).toBe('Wine not found');
    expect(loadFailureReason(new Error(''), 'This wine could not be loaded.')).toBe('This wine could not be loaded.');
    expect(loadFailureReason(true, 'This wine could not be loaded.')).toBe('This wine could not be loaded.');
  });
});

describe('LoadError', () => {
  it('announces the reason and retries on request', () => {
    const retry = vi.fn();
    render(<LoadError error={new Error('Wine not found')} fallback="Fallback" onRetry={retry} />);
    expect(screen.getByRole('alert').textContent).toContain('Wine not found');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
  it('offers no retry where none was given', () => {
    render(<LoadError error="Gone" fallback="Fallback" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
