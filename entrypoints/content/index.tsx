import './style.css';

import ReactDOM from 'react-dom/client';

import { ContentApp } from '../../src/features/overlay/content-app';
import { createLyricsOverlayGate } from '../../src/features/overlay/overlay-gate';
import { hasVisibleSpotifyLyrics } from '../../src/features/spotify/spotify-dom';
import { isExtensionContextInvalidatedError } from '../../src/shared/extension-api';

export default defineContentScript({
  matches: ['https://open.spotify.com/*'],
  cssInjectionMode: 'ui',
  main(ctx) {
    const gate = createLyricsOverlayGate({
      hasVisibleLyrics: () => hasVisibleSpotifyLyrics(),
      mountOverlay: async () => {
        const ui = await createShadowRootUi(ctx, {
          name: 'lyra-overlay',
          position: 'inline',
          anchor: 'body',
          append: 'last',
          onMount: (container) => {
            const root = ReactDOM.createRoot(container);
            root.render(<ContentApp />);
            return root;
          },
          onRemove: (root) => {
            root?.unmount();
          },
        });

        ui.mount();

        return {
          remove: () => {
            ui.remove();
          },
        };
      },
      observeDomChanges: (listener) => {
        const observer = new MutationObserver(listener);
        observer.observe(document.body || document.documentElement, {
          attributes: true,
          childList: true,
          characterData: true,
          subtree: true,
        });

        return () => {
          observer.disconnect();
        };
      },
      removeInactiveOverlay: () => {
        document.querySelectorAll('lyra-overlay').forEach((element) => {
          element.remove();
        });
      },
      onError: (error) => {
        // Old content scripts can be invalidated during extension reload/HMR.
        if (isExtensionContextInvalidatedError(error)) {
          return;
        }

        throw error;
      },
    });

    gate.start();
  },
});
