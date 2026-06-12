interface LyricsOverlayMount {
  remove: () => void | Promise<void>;
}

interface LyricsOverlayGateOptions {
  hasVisibleLyrics: () => boolean;
  mountOverlay: () => LyricsOverlayMount | Promise<LyricsOverlayMount>;
  observeDomChanges: (listener: () => void) => () => void;
  onError?: (error: unknown) => void;
  removeInactiveOverlay?: () => void;
}

export function createLyricsOverlayGate(options: LyricsOverlayGateOptions) {
  let mountedOverlay: LyricsOverlayMount | null = null;
  let isMounting = false;
  let isStopped = true;
  let stopObserving: (() => void) | null = null;

  const reportError = (error: unknown) => {
    options.onError?.(error);
  };

  const removeMountedOverlay = () => {
    if (!mountedOverlay) {
      return;
    }

    const overlay = mountedOverlay;
    mountedOverlay = null;

    try {
      void overlay.remove();
    } catch (error) {
      reportError(error);
    }
  };

  const finishMount = (overlay: LyricsOverlayMount) => {
    isMounting = false;

    if (isStopped || !options.hasVisibleLyrics()) {
      try {
        void overlay.remove();
      } catch (error) {
        reportError(error);
      }
      return;
    }

    mountedOverlay = overlay;
  };

  const mountOverlay = () => {
    if (mountedOverlay || isMounting || isStopped) {
      return;
    }

    try {
      const mountResult = options.mountOverlay();

      if (isPromiseLike(mountResult)) {
        isMounting = true;
        mountResult.then(finishMount).catch((error: unknown) => {
          isMounting = false;
          reportError(error);
        });
        return;
      }

      finishMount(mountResult);
    } catch (error) {
      isMounting = false;
      reportError(error);
    }
  };

  const sync = () => {
    if (isStopped) {
      return;
    }

    if (!options.hasVisibleLyrics()) {
      removeMountedOverlay();
      options.removeInactiveOverlay?.();
      return;
    }

    mountOverlay();
  };

  return {
    start() {
      if (!isStopped) {
        return;
      }

      isStopped = false;
      stopObserving = options.observeDomChanges(sync);
      sync();
    },
    stop() {
      if (isStopped) {
        return;
      }

      isStopped = true;
      stopObserving?.();
      stopObserving = null;
      removeMountedOverlay();
    },
    isMounted() {
      return mountedOverlay !== null;
    },
  };
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'then' in value &&
      typeof (value as Promise<T>).then === 'function',
  );
}
