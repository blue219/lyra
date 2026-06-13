import './style.css';

import ReactDOM from 'react-dom/client';

import {
  ContentApp,
  shouldMountLyricsExperience,
} from '../../src/features/overlay/content-app';
import { clearInlineLyrics } from '../../src/features/overlay/inline-lyrics';
import { createLyricsOverlayGate } from '../../src/features/overlay/overlay-gate';
import {
  hasVisibleSpotifyLyrics,
  isSpotifyLyricsPage,
} from '../../src/features/spotify/spotify-dom';
import { isExtensionContextInvalidatedError } from '../../src/shared/extension-api';

function injectLyricsHoverOverride() {
  const style = document.createElement('style');
  style.setAttribute('data-lyra', 'hover-override');
  style.textContent = `
    [data-testid="lyrics-line"]:hover,
    [data-testid="lyrics-line"]:hover *,
    [data-lyric-index]:hover {
      background: transparent !important;
      background-color: transparent !important;
      text-decoration: none !important;
      border-left: none !important;
      color: inherit !important;
    }

    [data-lyra-native-lyrics-hidden="true"],
    [data-lyra-native-lyrics-hidden="true"] * {
      -webkit-text-fill-color: transparent !important;
      text-shadow: none !important;
    }

    .lyra-replacement-host {
      position: relative;
      z-index: 3;
      width: 100%;
      color: #ffffff;
      font-family: SpotifyMixUITitle, SpotifyMixUI, "Helvetica Neue", helvetica, arial, sans-serif;
    }
  `;
  document.head.append(style);
}

export default defineContentScript({
  matches: ['https://open.spotify.com/*'],
  cssInjectionMode: 'ui',
  main(ctx) {
    injectLyricsHoverOverride();

    const gate = createLyricsOverlayGate({
      hasVisibleLyrics: () =>
        shouldMountLyricsExperience(isSpotifyLyricsPage(), hasVisibleSpotifyLyrics()),
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
        clearInlineLyrics();
        document
          .querySelectorAll('[data-lyra-native-lyrics-hidden="true"]')
          .forEach((element) => {
            element.removeAttribute('data-lyra-native-lyrics-hidden');
          });
        document
          .querySelectorAll('[data-lyra-replacement-host="true"]')
          .forEach((element) => {
            element.remove();
          });
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
