type ExtensionApi = typeof browser;

export function getExtensionApi(): ExtensionApi | null {
  const browserApi = (globalThis as typeof globalThis & {
    browser?: ExtensionApi;
    chrome?: ExtensionApi;
  }).browser;

  if (browserApi) {
    return browserApi;
  }

  const chromeApi = (globalThis as typeof globalThis & {
    chrome?: ExtensionApi;
  }).chrome;

  return chromeApi ?? null;
}

export function isExtensionContextInvalidatedError(error: unknown): boolean {
  if (typeof error === 'string') {
    return /Extension context invalidated|Content script context invalidated/i.test(error);
  }

  return (
    error instanceof Error &&
    /Extension context invalidated|Content script context invalidated/i.test(error.message)
  );
}
