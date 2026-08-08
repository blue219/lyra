import ReactDOM from 'react-dom/client';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

import { ContentApp } from '@/src/ui/overlay/content-app';
import { removeLegacyInlineLyrics } from '@/src/ui/overlay/legacy-cleanup';
import './style.css';

export default async (ctx: ContentScriptContext) => {
  removeLegacyInlineLyrics(document);
  injectNativeLyricsOverride();

  const stylesText = await fetch(
    browser.runtime.getURL('/content-scripts/esm/content.css' as never),
  ).then((response) => response.text());
  const ui = await createShadowRootUi(ctx, {
    name: 'lyra-overlay',
    position: 'inline',
    anchor: 'body',
    append: 'last',
    onMount(container, shadow) {
      const style = document.createElement('style');
      style.textContent = stylesText.replaceAll(':root', ':host');
      shadow.querySelector('head')?.append(style);

      const root = ReactDOM.createRoot(container);
      root.render(<ContentApp />);
      return root;
    },
    onRemove(root) {
      root?.unmount();
    },
  });
  ui.mount();

  return {
    remove() {
      ui.remove();
      document
        .querySelectorAll('[data-lyra-native-lyrics-hidden="true"]')
        .forEach((element) =>
          element.removeAttribute('data-lyra-native-lyrics-hidden'),
        );
    },
  };
};

function injectNativeLyricsOverride(): void {
  if (document.querySelector('[data-lyra="native-lyrics-override"]')) return;
  const style = document.createElement('style');
  style.dataset.lyra = 'native-lyrics-override';
  style.textContent = `
    [data-testid="lyrics-line"]:hover,
    [data-testid="lyrics-line"]:hover * { background: transparent !important; }
    [data-lyra-native-lyrics-hidden="true"],
    [data-lyra-native-lyrics-hidden="true"] * {
      -webkit-text-fill-color: transparent !important;
      text-shadow: none !important;
    }
    .lyra-replacement-host { position: relative; z-index: 3; width: 100%; color: #fff; }
  `;
  document.head.append(style);
}
