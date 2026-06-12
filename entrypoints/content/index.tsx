import './style.css';

import ReactDOM from 'react-dom/client';

import { ContentApp } from '../../src/features/overlay/content-app';
import { isExtensionContextInvalidatedError } from '../../src/shared/extension-api';

export default defineContentScript({
  matches: ['https://open.spotify.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    try {
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
    } catch (error) {
      // Old content scripts can be invalidated during extension reload/HMR.
      if (isExtensionContextInvalidatedError(error)) {
        return;
      }

      throw error;
    }
  },
});
