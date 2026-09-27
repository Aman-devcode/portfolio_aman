import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WelcomeExperience } from './WelcomeExperience';

vi.mock('../audio/AudioManager', () => ({
  useAudioManager: () => ({
    available: false,
    hasPlayed: false,
    playing: false,
    playWelcome: vi.fn().mockResolvedValue('unavailable'),
    stopWelcome: vi.fn(),
  }),
}));

describe('WelcomeExperience', () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
      root = undefined;
    }
    container?.remove();
    container = undefined;
    vi.restoreAllMocks();
  });

  it('resets the page to the normal portfolio state and removes the overlay after Enter Portfolio', async () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<WelcomeExperience><div>Portfolio content</div></WelcomeExperience>);
    });

    const enterButton = container.querySelector<HTMLButtonElement>('.welcome-panel button');
    expect(enterButton).not.toBeNull();

    await act(async () => {
      enterButton!.click();
    });

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    expect(container.querySelector('.welcome-overlay')).toBeNull();
  });
});
