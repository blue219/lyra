export function removeLegacyInlineLyrics(rootDocument: Document): void {
  rootDocument
    .querySelectorAll('[data-lyra-inline-translation="true"]')
    .forEach((element) => element.remove());

  rootDocument
    .querySelectorAll<HTMLElement>('[data-lyra-active-line="true"]')
    .forEach((element) => {
      element.removeAttribute('data-lyra-active-line');
      element.style.borderLeft = '';
      element.style.boxShadow = '';
      element.style.paddingLeft = '';
    });
}
