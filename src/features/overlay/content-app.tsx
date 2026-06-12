import { useEffect, useState } from 'react';

import { LyricsOverlay } from './lyrics-overlay';
import { findActiveLyricIndex } from '../lyrics/lyrics';
import { requestTranslatedLyrics } from '../lyrics/messages';
import { defaultOverlaySettings, sanitizeOverlaySettings } from '../settings/settings';
import {
  readCurrentTrackIdentity,
  readPlaybackPositionMs,
  readSpotifyLyricsSnapshot,
} from '../spotify/spotify-dom';
import { createTrackCacheKey, normalizeTrackIdentity } from '../spotify/track';
import { getExtensionApi } from '../../shared/extension-api';
import type { LyricLine, LyricsResult, OverlaySettings, TrackIdentity } from '../../shared/types';

type OverlayPhase = 'waiting-track' | 'loading' | 'ready' | 'unavailable' | 'error';

const emptyLyricsResult: LyricsResult = {
  status: 'unavailable',
  lines: [],
};

const overlaySettingsStorageKey = 'overlaySettings';

export function ContentApp() {
  const extensionApi = getExtensionApi();
  const [track, setTrack] = useState<TrackIdentity | null>(null);
  const [lyrics, setLyrics] = useState<LyricsResult>(emptyLyricsResult);
  const [phase, setPhase] = useState<OverlayPhase>('waiting-track');
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [spotifyLyricsLines, setSpotifyLyricsLines] = useState<LyricLine[]>([]);
  const [spotifyActiveLineIndex, setSpotifyActiveLineIndex] = useState(-1);
  const [settings, setSettings] = useState<OverlaySettings>(defaultOverlaySettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeLineIndex =
    lyrics.source === 'spotify'
      ? spotifyActiveLineIndex
      : findActiveLyricIndex(lyrics.lines, playbackPositionMs);
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
    // Spotify's player metadata can change without a page navigation, so we
    // poll the visible player DOM and only commit state when the track key moves.
    const syncPlaybackState = () => {
      const nextTrack = readCurrentTrackIdentity();
      const nextPlaybackPositionMs = readPlaybackPositionMs();
      const nextSpotifyLyrics = readSpotifyLyricsSnapshot();

      if (nextPlaybackPositionMs !== null) {
        setPlaybackPositionMs(nextPlaybackPositionMs);
      }

      setSpotifyActiveLineIndex(nextSpotifyLyrics?.activeLineIndex ?? -1);
      setSpotifyLyricsLines((currentLines) => {
        const nextLines = nextSpotifyLyrics?.lines ?? [];
        return createLyricsKey(currentLines) === createLyricsKey(nextLines)
          ? currentLines
          : nextLines;
      });

      setTrack((currentTrack) => {
        if (!nextTrack) {
          return currentTrack === null ? currentTrack : null;
        }

        const normalizedTrack = normalizeTrackIdentity(nextTrack);

        if (
          currentTrack &&
          createTrackCacheKey(currentTrack) === createTrackCacheKey(normalizedTrack)
        ) {
          return currentTrack;
        }

        setPlaybackPositionMs(nextPlaybackPositionMs ?? 0);
        return normalizedTrack;
      });
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
    <LyricsOverlay
      activeLineIndex={activeLineIndex}
      lyrics={lyrics}
      phase={phase}
      settings={settings}
      settingsOpen={settingsOpen}
      track={track}
      onSettingsChange={updateSettings}
      onToggleSettings={() => setSettingsOpen((value) => !value)}
    />
  );
}

export function shouldRequestVisibleSpotifyLyrics(lines: LyricLine[]): boolean {
  return lines.length > 0;
}

function createLyricsKey(lines: LyricLine[]): string {
  return lines.map((line) => line.original).join('\n');
}
