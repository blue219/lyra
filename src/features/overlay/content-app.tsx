import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import { ReplacementLyrics } from './replacement-lyrics';
import { clearInlineLyrics } from './inline-lyrics';
import { findActiveLyricIndex } from '../lyrics/lyrics';
import { requestLyrics, requestTranslatedLyrics } from '../lyrics/messages';
import { defaultOverlaySettings, sanitizeOverlaySettings } from '../settings/settings';
import {
  markNativeSpotifyLyricsHidden,
  readCurrentTrackIdentity,
  readPlaybackPositionMs,
  readSpotifyLyricsPageContainer,
  readSpotifyLyricsSnapshot,
} from '../spotify/spotify-dom';
import { getExtensionApi } from '../../shared/extension-api';
import type {
  LyricLine,
  LyricsResult,
  OverlaySettings,
  TrackIdentity,
} from '../../shared/types';

type OverlayPhase = 'waiting-track' | 'loading' | 'ready' | 'unavailable' | 'error';

type LyricsRequestSelection =
  | { type: 'spotify'; lines: LyricLine[] }
  | { type: 'lrclib'; track: TrackIdentity }
  | { type: 'none' };

interface ActiveLineInput {
  lyricsSource: LyricsResult['source'];
  spotifyActiveLineIndex: number;
  playbackPositionMs: number | null;
  lines: LyricLine[];
}

const emptyLyricsResult: LyricsResult = {
  status: 'unavailable',
  lines: [],
};

const overlaySettingsStorageKey = 'overlaySettings';
const replacementHostAttribute = 'data-lyra-replacement-host';

export function ContentApp() {
  const extensionApi = getExtensionApi();
  const [lyrics, setLyrics] = useState<LyricsResult>(emptyLyricsResult);
  const [phase, setPhase] = useState<OverlayPhase>('waiting-track');
  const [spotifyActiveLineIndex, setSpotifyActiveLineIndex] = useState(-1);
  const [spotifyLyricsLines, setSpotifyLyricsLines] = useState<LyricLine[]>([]);
  const [currentTrack, setCurrentTrack] = useState<TrackIdentity | null>(null);
  const [playbackPositionMs, setPlaybackPositionMs] = useState<number | null>(null);
  const [settings, setSettings] = useState<OverlaySettings>(defaultOverlaySettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<SettingsAnchor | null>(null);
  const [replacementHost, setReplacementHost] = useState<HTMLElement | null>(null);
  const [lyricsDomVersion, setLyricsDomVersion] = useState(0);

  const lyricsSelection = selectLyricsRequest(spotifyLyricsLines, currentTrack);
  const lyricsRequestKey = createLyricsRequestKey(lyricsSelection, settings.targetLanguage);
  const activeLineIndex = getReplacementActiveLineIndex({
    lyricsSource: lyrics.source,
    spotifyActiveLineIndex,
    playbackPositionMs,
    lines: lyrics.lines,
  });

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
    const syncPlaybackState = () => {
      const nextSpotifyLyrics = readSpotifyLyricsSnapshot();
      const lyricsContainer = readSpotifyLyricsPageContainer();
      const nextHost = lyricsContainer
        ? ensureReplacementHost(document, lyricsContainer)
        : null;

      setReplacementHost((currentHost) =>
        currentHost === nextHost ? currentHost : nextHost,
      );
      setSettingsAnchor(readSettingsAnchor(lyricsContainer));
      setSpotifyActiveLineIndex(nextSpotifyLyrics?.activeLineIndex ?? -1);
      setSpotifyLyricsLines((currentLines) => {
        const nextLines = nextSpotifyLyrics?.lines ?? [];
        return createLyricsKey(currentLines) === createLyricsKey(nextLines)
          ? currentLines
          : nextLines;
      });
      setCurrentTrack(readCurrentTrackIdentity());
      setPlaybackPositionMs(readPlaybackPositionMs());
      setLyricsDomVersion((version) => version + 1);
    };

    syncPlaybackState();

    const intervalId = window.setInterval(syncPlaybackState, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (lyricsSelection.type === 'none') {
      setLyrics(emptyLyricsResult);
      setPhase('waiting-track');
      return;
    }

    let isCancelled = false;
    setPhase('loading');

    const lyricsRequest =
      lyricsSelection.type === 'spotify'
        ? requestTranslatedLyrics(
            lyricsSelection.lines,
            settings.targetLanguage,
            'spotify',
          )
        : requestLyrics(lyricsSelection.track, settings.targetLanguage);

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
  }, [lyricsRequestKey]);

  useEffect(() => {
    const shouldHideNativeLyrics =
      replacementHost !== null && shouldRequestVisibleSpotifyLyrics(spotifyLyricsLines);

    markNativeSpotifyLyricsHidden(document, shouldHideNativeLyrics);

    return () => {
      markNativeSpotifyLyricsHidden(document, false);
    };
  }, [lyricsDomVersion, replacementHost, spotifyLyricsLines]);

  useEffect(() => {
    clearInlineLyrics();
  }, [lyricsDomVersion]);

  useEffect(() => {
    const scroller = replacementHost?.querySelector<HTMLElement>(
      '[data-lyra-replacement-scroll="true"]',
    );
    const activeLine = scroller?.querySelector<HTMLElement>(
      '[data-lyra-replacement-active="true"]',
    );

    if (!scroller || !activeLine) {
      return;
    }

    const scrollTop = calculateCenteredScrollTop({
      activeOffsetTop: activeLine.offsetTop,
      activeHeight: activeLine.offsetHeight,
      containerHeight: scroller.clientHeight,
      maxScrollTop: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
    });

    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({
        top: scrollTop,
        behavior: 'smooth',
      });
      return;
    }

    scroller.scrollTop = scrollTop;
  }, [activeLineIndex, lyrics, replacementHost]);

  useEffect(() => {
    return () => {
      clearInlineLyrics();
      markNativeSpotifyLyricsHidden(document, false);
      document
        .querySelectorAll(`[${replacementHostAttribute}="true"]`)
        .forEach((host) => host.remove());
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

  if (!replacementHost && lyricsSelection.type === 'none') {
    return null;
  }

  return (
    <>
      {replacementHost
        ? createPortal(
            <ReplacementLyrics
              activeLineIndex={activeLineIndex}
              fontSize={settings.fontSize}
              lyrics={phase === 'loading' ? lyrics : lyrics}
              targetLanguage={settings.targetLanguage}
            />,
            replacementHost,
          )
        : null}

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
    </>
  );
}

export function shouldRequestVisibleSpotifyLyrics(lines: LyricLine[]): boolean {
  return lines.length > 0;
}

export function shouldMountLyricsExperience(
  isLyricsPage: boolean,
  hasVisibleLyrics: boolean,
): boolean {
  return isLyricsPage || hasVisibleLyrics;
}

export function selectLyricsRequest(
  spotifyLyricsLines: LyricLine[],
  track: TrackIdentity | null,
): LyricsRequestSelection {
  if (shouldRequestVisibleSpotifyLyrics(spotifyLyricsLines)) {
    return {
      type: 'spotify',
      lines: spotifyLyricsLines,
    };
  }

  if (track) {
    return {
      type: 'lrclib',
      track,
    };
  }

  return { type: 'none' };
}

export function getReplacementActiveLineIndex({
  lyricsSource,
  spotifyActiveLineIndex,
  playbackPositionMs,
  lines,
}: ActiveLineInput): number {
  if (lyricsSource === 'spotify') {
    return spotifyActiveLineIndex;
  }

  if (lyricsSource === 'lrclib' && playbackPositionMs !== null) {
    return findActiveLyricIndex(lines, playbackPositionMs);
  }

  return -1;
}

export function calculateCenteredScrollTop({
  activeOffsetTop,
  activeHeight,
  containerHeight,
  maxScrollTop,
}: {
  activeOffsetTop: number;
  activeHeight: number;
  containerHeight: number;
  maxScrollTop: number;
}): number {
  const centeredTop = activeOffsetTop + activeHeight / 2 - containerHeight / 2;

  return Math.min(Math.max(0, centeredTop), maxScrollTop);
}

function createLyricsRequestKey(
  selection: LyricsRequestSelection,
  targetLanguage: string,
): string {
  if (selection.type === 'spotify') {
    return ['spotify', targetLanguage, createLyricsKey(selection.lines)].join('__');
  }

  if (selection.type === 'lrclib') {
    return [
      'lrclib',
      targetLanguage,
      selection.track.title,
      selection.track.artists.join(','),
      selection.track.album ?? '',
      selection.track.durationSeconds ?? '',
    ].join('__');
  }

  return 'none';
}

function createLyricsKey(lines: LyricLine[]): string {
  return lines.map((line) => line.original).join('\n');
}

function ensureReplacementHost(
  rootDocument: Document,
  container: HTMLElement,
): HTMLElement {
  const existingHost = container.querySelector<HTMLElement>(
    `:scope > [${replacementHostAttribute}="true"]`,
  );

  if (existingHost) {
    return existingHost;
  }

  const host = rootDocument.createElement('div');
  host.setAttribute(replacementHostAttribute, 'true');
  host.className = 'lyra-replacement-host';
  container.prepend(host);

  return host;
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
    return 'Loading synced lyrics.';
  }

  if (phase === 'ready' && lyrics.status === 'bilingual') {
    return 'Lyra lyrics are synced with playback.';
  }

  if (phase === 'ready' && lyrics.status === 'monolingual') {
    return 'Showing original lyrics only for this language pair.';
  }

  if (phase === 'error') {
    return 'Lyrics failed to load. Lyra will retry when the song changes.';
  }

  return 'Waiting for the current track.';
}
