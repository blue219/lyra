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
    expect(html).not.toContain('circle_at_top_left');
    expect(html).toContain('w-[274px]');
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
    expect(container.innerHTML).not.toContain(
      'Falls back to static when motion should be reduced.',
    );

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

  test('shows cache summary and clears cache from the popup settings', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({
        songCount: 12,
        entryCount: 14,
        maxEntries: 200,
        sizeBytes: 3_584,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        songCount: 0,
        entryCount: 0,
        maxEntries: 200,
        sizeBytes: 2,
      });
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PopupApp
          extensionApi={
            {
              runtime: {
                sendMessage,
              },
              storage: {
                local: {
                  get: vi.fn().mockResolvedValue({
                    overlaySettings: {
                      targetLanguage: 'en-US',
                      fontSize: 'md',
                      dynamicBackground: true,
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

    expect(container.textContent).toContain('Cached songs');
    expect(container.textContent).toContain('12/200');
    expect(container.textContent).toContain('Cache size');
    expect(container.textContent).toContain('3.5 KB');
    expect(container.innerHTML).toContain('bg-[#ff1010]');
    expect(container.innerHTML).toContain('rounded-[999px] bg-[#ff1010]');
    expect(container.innerHTML).not.toContain('border-t border-white/10');

    const clearButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.toUpperCase().includes('CLEAR'),
    );

    await act(async () => {
      clearButton?.click();
      await flushEffects();
    });

    expect(sendMessage).toHaveBeenNthCalledWith(1, { type: 'lyra:getLyricsCacheSummary' });
    expect(sendMessage).toHaveBeenNthCalledWith(2, { type: 'lyra:clearLyricsCache' });
    expect(sendMessage).toHaveBeenNthCalledWith(3, { type: 'lyra:getLyricsCacheSummary' });
    expect(container.textContent).toContain('0/200');

    await act(async () => {
      root.unmount();
    });
  });
});
