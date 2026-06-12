import { useEffect, useState, type CSSProperties } from 'react';

import { clearInlineLyrics, renderInlineLyrics } from './inline-lyrics';
import { requestTranslatedLyrics } from '../lyrics/messages';
import { defaultOverlaySettings, sanitizeOverlaySettings } from '../settings/settings';
import {
  readSpotifyLyricsContainer,
  readSpotifyLyricsSnapshot,
} from '../spotify/spotify-dom';
import { getExtensionApi } from '../../shared/extension-api';
import type { LyricLine, LyricsResult, OverlaySettings } from '../../shared/types';

type OverlayPhase = 'waiting-track' | 'loading' | 'ready' | 'unavailable' | 'error';

const emptyLyricsResult: LyricsResult = {
  status: 'unavailable',
  lines: [],
};

const overlaySettingsStorageKey = 'overlaySettings';

export function ContentApp() {
  const extensionApi = getExtensionApi();
  const [lyrics, setLyrics] = useState<LyricsResult>(emptyLyricsResult);
  const [phase, setPhase] = useState<OverlayPhase>('waiting-track');
  const [spotifyActiveLineIndex, setSpotifyActiveLineIndex] = useState(-1);
  const [spotifyLyricsLines, setSpotifyLyricsLines] = useState<LyricLine[]>([]);
  const [settings, setSettings] = useState<OverlaySettings>(defaultOverlaySettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<SettingsAnchor | null>(null);
  const [lyricsDomVersion, setLyricsDomVersion] = useState(0);

  const spotifyLyricsKey = createLyricsKey(spotifyLyricsLines);

  useEffect(() => {
    let isCancelled = false;

    if (!extensionApi?.storage?.local) {
      setSettings(defaultOverlaySettings);
      return () => {
        isCancelled = true;
      };
    }

    extensionApi.storage.local
      .get(overlaySettingsStorageKey)
      .then((storedValue) => {
        if (isCancelled) {
          return;
        }

        setSettings(
          sanitizeOverlaySettings(
            storedValue[overlaySettingsStorageKey] as Partial<OverlaySettings> | undefined,
          ),
        );
      })
      .catch(() => {
        if (!isCancelled) {
          setSettings(defaultOverlaySettings);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    // Spotify can replace lyric DOM nodes while the visible text is unchanged.
    // The version tick lets Lyra re-attach translations to the current nodes.
    const syncPlaybackState = () => {
      const nextSpotifyLyrics = readSpotifyLyricsSnapshot();
      const lyricsContainer = readSpotifyLyricsContainer();

      setSettingsAnchor(readSettingsAnchor(lyricsContainer));
      setSpotifyActiveLineIndex(nextSpotifyLyrics?.activeLineIndex ?? -1);
      setSpotifyLyricsLines((currentLines) => {
        const nextLines = nextSpotifyLyrics?.lines ?? [];
        return createLyricsKey(currentLines) === createLyricsKey(nextLines)
          ? currentLines
          : nextLines;
      });
      setLyricsDomVersion((version) => version + 1);
    };

    syncPlaybackState();

    const intervalId = window.setInterval(syncPlaybackState, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!shouldRequestVisibleSpotifyLyrics(spotifyLyricsLines)) {
      setLyrics(emptyLyricsResult);
      setPhase('waiting-track');
      clearInlineLyrics();
      return;
    }

    let isCancelled = false;

    setPhase('loading');
    setLyrics(emptyLyricsResult);

    const lyricsRequest = requestTranslatedLyrics(
      spotifyLyricsLines,
      settings.targetLanguage,
      'spotify',
    );

    lyricsRequest
      .then((nextLyrics) => {
        if (isCancelled) {
          return;
        }

        console.log('[Lyra] content received lyrics:', nextLyrics.status, nextLyrics.lines.length);
        setLyrics(nextLyrics);
        setPhase(nextLyrics.status === 'unavailable' ? 'unavailable' : 'ready');
      })
      .catch(() => {
        if (!isCancelled) {
          console.error('[Lyra] content lyrics fetch rejected');
          setLyrics(emptyLyricsResult);
          setPhase('error');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [settings.targetLanguage, spotifyLyricsKey]);

  useEffect(() => {
    if (phase === 'ready') {
      renderInlineLyrics(document, lyrics, {
        activeLineIndex: spotifyActiveLineIndex,
        fontSize: settings.fontSize,
        targetLanguage: settings.targetLanguage,
      });
      return;
    }

    clearInlineLyrics();
  }, [
    lyrics,
    lyricsDomVersion,
    phase,
    settings.fontSize,
    settings.targetLanguage,
    spotifyActiveLineIndex,
  ]);

  useEffect(() => {
    return () => {
      clearInlineLyrics();
    };
  }, []);

  function updateSettings(patch: Partial<OverlaySettings>) {
    setSettings((currentSettings) => {
      const nextSettings = sanitizeOverlaySettings({
        ...currentSettings,
        ...patch,
      });

      if (extensionApi?.storage?.local) {
        void extensionApi.storage.local.set({
          [overlaySettingsStorageKey]: nextSettings,
        });
      }

      return nextSettings;
    });
  }

  if (!shouldRequestVisibleSpotifyLyrics(spotifyLyricsLines)) {
    return null;
  }

  return (
    <div
      className="fixed z-[2147483647] font-[var(--lyra-font-ui)] text-[var(--lyra-color-text)]"
      style={getSettingsEntryStyle(settingsAnchor)}
    >
      <button
        aria-label="Open Lyra settings"
        className={[
          'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[var(--lyra-color-surface-2)] text-sm font-black text-[var(--lyra-color-accent)] shadow-[var(--lyra-shadow-elevated)] transition hover:border-white/30',
          settingsOpen ? 'ring-2 ring-[var(--lyra-color-accent)]/50' : '',
        ].join(' ')}
        type="button"
        onClick={() => setSettingsOpen((value) => !value)}
      >
        L
      </button>

      {settingsOpen ? (
        <section className="mt-3 w-[min(88vw,280px)] rounded-[18px] border border-white/10 bg-[var(--lyra-color-surface)] p-4 shadow-[var(--lyra-shadow-dialog)]">
          <div>
            <label
              className="text-[10px] font-bold uppercase tracking-[2px] text-[var(--lyra-color-muted)]"
              htmlFor="lyra-target-language"
            >
              Target language
            </label>
            <select
              className="mt-2 w-full rounded-full border border-[var(--lyra-color-border)] bg-[var(--lyra-color-surface-2)] px-4 py-3 text-sm text-white outline-none"
              id="lyra-target-language"
              value={settings.targetLanguage}
              onChange={(event) =>
                updateSettings({ targetLanguage: event.target.value })
              }
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[2px] text-[var(--lyra-color-muted)]">
              Font size
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['sm', 'md', 'lg'] as const).map((fontSize) => (
                <button
                  key={fontSize}
                  className={[
                    'rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[1.8px] transition',
                    settings.fontSize === fontSize
                      ? 'bg-[var(--lyra-color-accent)] text-black'
                      : 'border border-[var(--lyra-color-border)] bg-[var(--lyra-color-surface-2)] text-white hover:border-white',
                  ].join(' ')}
                  type="button"
                  onClick={() => updateSettings({ fontSize })}
                >
                  {fontSize}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-[var(--lyra-color-muted)]">
            {getPhaseLabel(phase, lyrics)}
          </p>
        </section>
      ) : null}
    </div>
  );
}

export function shouldRequestVisibleSpotifyLyrics(lines: LyricLine[]): boolean {
  return lines.length > 0;
}

function createLyricsKey(lines: LyricLine[]): string {
  return lines.map((line) => line.original).join('\n');
}

const languageOptions = [
  { value: 'en-US', label: 'English' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
];

interface SettingsAnchor {
  right: number;
  top: number;
}

function readSettingsAnchor(container: HTMLElement | null): SettingsAnchor | null {
  if (!container) {
    return null;
  }

  const rect = container.getBoundingClientRect();

  if (rect.width <= 0 && rect.height <= 0) {
    return null;
  }

  return {
    right: Math.max(16, window.innerWidth - rect.right + 16),
    top: Math.max(16, rect.top + 16),
  };
}

function getSettingsEntryStyle(anchor: SettingsAnchor | null): CSSProperties {
  if (!anchor) {
    return {
      right: 16,
      top: 16,
    };
  }

  return {
    right: anchor.right,
    top: anchor.top,
  };
}

function getPhaseLabel(phase: OverlayPhase, lyrics: LyricsResult): string {
  if (phase === 'loading') {
    return 'Translating visible Spotify lyrics.';
  }

  if (phase === 'ready' && lyrics.status === 'bilingual') {
    return 'Inline translations are visible under Spotify lyrics.';
  }

  if (phase === 'ready' && lyrics.status === 'monolingual') {
    return 'Showing original lyrics only for this language pair.';
  }

  if (phase === 'error') {
    return 'Translation failed. Lyra will retry when Spotify lyrics change.';
  }

  return 'Waiting for visible Spotify lyrics.';
}
