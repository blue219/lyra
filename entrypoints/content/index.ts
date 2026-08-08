import type { ContentScriptContext } from 'wxt/utils/content-script-context';

type EsmContentModule = {
  default: (context: ContentScriptContext) => Promise<{ remove: () => void }>;
};

export default defineContentScript({
  matches: ['https://open.spotify.com/*'],
  async main(ctx) {
    let mounted: { remove: () => void } | null = null;
    let loading: Promise<void> | null = null;

    const shouldLoad = () =>
      window.location.pathname.includes('/lyrics') ||
      Boolean(document.querySelector('[data-testid="lyrics-line"]'));

    const sync = () => {
      if (!shouldLoad()) {
        mounted?.remove();
        mounted = null;
        return;
      }
      if (mounted || loading) return;

      loading = (async () => {
        /* @vite-ignore */
        const module = (await import(
          browser.runtime.getURL('/content-scripts/esm/content.js' as never)
        )) as EsmContentModule;
        const next = await module.default(ctx);
        if (shouldLoad() && ctx.isValid) mounted = next;
        else next.remove();
      })().finally(() => {
        loading = null;
      });
    };

    let scheduled = false;
    const scheduleSync = () => {
      if (scheduled) return;
      scheduled = true;
      ctx.requestAnimationFrame(() => {
        scheduled = false;
        sync();
      });
    };

    ctx.addEventListener(window, 'wxt:locationchange', scheduleSync);
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.querySelector('main') ?? document.body, {
      childList: true,
      subtree: true,
    });
    ctx.onInvalidated(() => {
      observer.disconnect();
      mounted?.remove();
    });
    sync();
  },
});
