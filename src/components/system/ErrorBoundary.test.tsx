import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Broken(): ReactElement { throw new Error('private render details'); }
describe('ErrorBoundary', () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;
  afterEach(() => { if (root) { act(() => root!.unmount()); root = undefined; } if (container) { container.remove(); container = undefined; } });
  it('shows a safe recovery UI and invokes reload action', () => {
    container = document.createElement('div'); document.body.append(container);
    root = createRoot(container); const reload = vi.fn(); const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => root!.render(<ErrorBoundary onReload={reload}><Broken/></ErrorBoundary>));
    expect(container.textContent).toContain('Something went wrong.'); expect(container.textContent).not.toContain('private render details');
    act(() => container!.querySelector('button')!.click()); expect(reload).toHaveBeenCalledOnce(); log.mockRestore();
  });
});
