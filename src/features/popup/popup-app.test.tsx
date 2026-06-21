// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

import { PopupApp } from './popup-app';

async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('PopupApp', () => {
  test('renders only the settings card without an extra popup shell', () => {
    const html = renderToStaticMarkup(<PopupApp extensionApi={null} />);

    expect(html).toContain('rounded-none');
    expect(html).toContain('border-none');
    expect(html).toContain('shadow-none');
    expect(html).not.toContain('p-3');
    expect(html).not.toContain('circle_at_top_left');
  });

  test('loads persisted settings into the popup controls', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PopupApp
          extensionApi={
            {
              storage: {
                local: {
                  get: vi.fn().mockResolvedValue({
                    overlaySettings: {
                      targetLanguage: 'zh-CN',
                      fontSize: 'lg',
                      dynamicBackground: false,
                    },
                  }),
                  set: vi.fn(),
                },
              },
            } as never
          }
        />,
      );
      await flushEffects();
    });

    expect(container.innerHTML).toContain('Target language');
    expect(
      container.querySelector<HTMLSelectElement>('#lyra-target-language')?.value,
    ).toBe('zh-CN');
    expect(container.innerHTML).toContain('aria-checked="false"');
    expect(container.innerHTML).toContain('LG');

    await act(async () => {
      root.unmount();
    });
  });

  test('persists updated settings when the user changes a control', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PopupApp
          extensionApi={
            {
              storage: {
                local: {
                  get: vi.fn().mockResolvedValue({
                    overlaySettings: {
                      targetLanguage: 'en-US',
                      fontSize: 'md',
                      dynamicBackground: true,
                    },
                  }),
                  set,
                },
              },
            } as never
          }
        />,
      );
      await flushEffects();
    });

    const toggle = container.querySelector<HTMLElement>('[role="switch"]');

    await act(async () => {
      toggle?.click();
      await flushEffects();
    });

    expect(set).toHaveBeenCalledWith({
      overlaySettings: {
        targetLanguage: 'en-US',
        fontSize: 'md',
        dynamicBackground: false,
      },
    });

    await act(async () => {
      root.unmount();
    });
  });
});
