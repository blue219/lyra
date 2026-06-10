import { useEffect, useState } from 'react';

import { LyricsOverlay } from './lyrics-overlay';
import { findActiveLyricIndex } from '../lib/lyrics';
import { requestLyrics } from '../lib/messages';
import { getExtensionApi } from '../lib/extension-api';
import { defaultOverlaySettings, sanitizeOverlaySettings } from '../lib/settings';
import { readCurrentTrackIdentity, readPlaybackPositionMs } from '../lib/spotify-dom';
import { createTrackCacheKey, normalizeTrackIdentity } from '../lib/track';
import type { LyricsResult, OverlaySettings, TrackIdentity } from '../lib/types';

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
  const [settings, setSettings] = useState<OverlaySettings>(defaultOverlaySettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeLineIndex = findActiveLyricIndex(lyrics.lines, playbackPositionMs);

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

      if (nextPlaybackPositionMs !== null) {
        setPlaybackPositionMs(nextPlaybackPositionMs);
      }

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
    if (!track) {
      setLyrics(emptyLyricsResult);
      setPhase('waiting-track');
      return;
    }

    let isCancelled = false;

    // Lyrics fetches are keyed by track only; local playback time keeps the
    // active-line highlight in sync without re-requesting remote data.
    setPhase('loading');
    setLyrics(emptyLyricsResult);

    requestLyrics(track)
      .then((nextLyrics) => {
        if (isCancelled) {
          return;
        }

        setLyrics(nextLyrics);
        setPhase(nextLyrics.status === 'unavailable' ? 'unavailable' : 'ready');
      })
      .catch(() => {
        if (!isCancelled) {
          setLyrics(emptyLyricsResult);
          setPhase('error');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [track]);

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
