import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitHubSection } from './GitHubSection';

describe('GitHubSection', () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;

  afterEach(() => {
    if (root !== undefined) {
      act(() => root!.unmount());
      root = undefined;
    }
    container?.remove();
    container = undefined;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function render() {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => {
      root!.render(<MemoryRouter><GitHubSection /></MemoryRouter> as ReactElement);
    });
  }

  it('renders a neutral disabled state without making a request when GitHub is not configured', async () => {
    vi.stubEnv('VITE_GITHUB_ENABLED', 'false');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container?.textContent).toContain('GitHub integration is currently disabled.');
  });
});
