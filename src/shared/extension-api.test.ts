import { afterEach, describe, expect, test } from 'vitest';

import { getExtensionApi, isExtensionContextInvalidatedError } from './extension-api';

describe('getExtensionApi', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis as Record<string, unknown>, 'browser');
    Reflect.deleteProperty(globalThis as Record<string, unknown>, 'chrome');
  });

  test('returns browser when it is available', () => {
    const browserApi = {
      runtime: {
        sendMessage() {
          return Promise.resolve();
        },
      },
    };

    (globalThis as Record<string, unknown>).browser = browserApi;

    expect(getExtensionApi()).toBe(browserApi);
  });

  test('falls back to chrome when browser is unavailable', () => {
    const chromeApi = {
      runtime: {
        sendMessage() {
          return Promise.resolve();
        },
      },
    };

    (globalThis as Record<string, unknown>).chrome = chromeApi;

    expect(getExtensionApi()).toBe(chromeApi);
  });

  test('returns null when neither browser nor chrome is available', () => {
    expect(getExtensionApi()).toBeNull();
  });

  test('detects invalidated extension context from an error object', () => {
    expect(
      isExtensionContextInvalidatedError(
        new Error('Uncaught Error: Extension context invalidated.'),
      ),
    ).toBe(true);
  });

  test('detects invalidated extension context from a string reason', () => {
    expect(isExtensionContextInvalidatedError('Content script context invalidated')).toBe(true);
  });
});
