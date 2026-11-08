export const replacementHostAttribute = 'data-lyra-replacement-host';
const cinemaToolbarHiddenAttribute = 'data-lyra-cinema-toolbar-hidden';

export function shouldMountLyricsExperience(
  isLyricsPage: boolean,
  hasVisibleLyrics: boolean,
): boolean {
  return isLyricsPage || hasVisibleLyrics;
}

export function ensureReplacementHost(
  rootDocument: Document,
  container: HTMLElement,
): HTMLElement {
  const allHosts = rootDocument.querySelectorAll<HTMLElement>(
    `[${replacementHostAttribute}="true"]`,
  );
  const existingHost = container.querySelector<HTMLElement>(
    `:scope > [${replacementHostAttribute}="true"]`,
  );

  if (existingHost) {
    allHosts.forEach((host) => {
      if (host !== existingHost) host.remove();
    });
    return existingHost;
  }

  allHosts.forEach((host) => host.remove());

  const host = rootDocument.createElement('div');
  host.setAttribute(replacementHostAttribute, 'true');
  host.className = 'lyra-replacement-host';
  container.prepend(host);

  return host;
}

export function removeReplacementHosts(rootDocument: Document) {
  rootDocument
    .querySelectorAll(`[${replacementHostAttribute}="true"]`)
    .forEach((host) => host.remove());
}

export function observeCinemaToolbar(container: HTMLElement) {
  const toolbar = container.previousElementSibling;
  if (
    !(toolbar instanceof HTMLElement) ||
    !toolbar.matches('[style*="--header-text-color:"]')
  ) {
    return;
  }

  const root = container.ownerDocument.documentElement;
  const syncVisibility = () => {
    const style = window.getComputedStyle(toolbar);
    root.toggleAttribute(
      cinemaToolbarHiddenAttribute,
      style.opacity === '0' ||
        style.visibility === 'hidden' ||
        style.display === 'none',
    );
  };
  const observer = new MutationObserver(syncVisibility);
  observer.observe(toolbar, {
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden'],
  });

  // Spotify leaves the toolbar mounted while its opacity transitions.
  const syncAfterFade = (event: TransitionEvent) => {
    if (event.target === toolbar && event.propertyName === 'opacity') {
      syncVisibility();
    }
  };
  toolbar.addEventListener('transitionend', syncAfterFade);
  toolbar.addEventListener('transitioncancel', syncAfterFade);
  syncVisibility();

  return () => {
    observer.disconnect();
    toolbar.removeEventListener('transitionend', syncAfterFade);
    toolbar.removeEventListener('transitioncancel', syncAfterFade);
    root.removeAttribute(cinemaToolbarHiddenAttribute);
  };
}
