export const replacementHostAttribute = 'data-lyra-replacement-host';

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
