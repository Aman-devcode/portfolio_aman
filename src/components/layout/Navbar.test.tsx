import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Navbar } from './Navbar';

vi.mock('../../features/audio/SoundToggle', () => ({ SoundToggle: () => <button type="button">Sound</button> }));

describe('Navbar mobile menu', () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;
  afterEach(() => { if (root) { act(() => root!.unmount()); root = undefined; } container?.remove(); container = undefined; vi.unstubAllGlobals(); });
  function render() {
    container = document.createElement('div'); document.body.append(container);
    root = createRoot(container);
    act(() => root!.render(<MemoryRouter initialEntries={['/']}><Navbar/></MemoryRouter> as ReactElement));
  }
  it('opens with focus on the first item, closes on Escape, and restores toggle focus', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    render();
    const toggle = container!.querySelector<HTMLButtonElement>('.menu-button')!;
    act(() => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(container!.querySelector('#mobile-navigation')?.hasAttribute('hidden')).toBe(false);
    expect(document.activeElement?.textContent).toContain('About');
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });
  it('closes after navigation and does not trap Tab', () => {
    render();
    const toggle = container!.querySelector<HTMLButtonElement>('.menu-button')!;
    act(() => toggle.click());
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => document.querySelector('#mobile-navigation')!.dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(false);
    act(() => container!.querySelector<HTMLAnchorElement>('#mobile-navigation a')!.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
