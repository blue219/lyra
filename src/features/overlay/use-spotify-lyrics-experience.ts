import { useEffect, useState } from 'react';

import type { LyricLine, TrackIdentity } from '../../shared/types';
import {
  hasUnsyncedSpotifyLyricsNotice,
  readCurrentTrackIdentity,
  readPlaybackPositionMs,
  readSpotifyLyricsPageContainer,
  readSpotifyLyricsSnapshot,
} from '../spotify/spotify-dom';
import { readSettingsAnchor, type SettingsAnchor } from './settings-entry';
import { createLyricsKey } from './lyrics-flow';
import { ensureReplacementHost } from './replacement-host';

export function useSpotifyLyricsExperience() {
  const [spotifyActiveLineIndex, setSpotifyActiveLineIndex] = useState(-1);
  const [spotifyLyricsLines, setSpotifyLyricsLines] = useState<LyricLine[]>([]);
  const [currentTrack, setCurrentTrack] = useState<TrackIdentity | null>(null);
  const [playbackPositionMs, setPlaybackPositionMs] = useState<number | null>(null);
  const [hasUnsyncedSpotifyLyrics, setHasUnsyncedSpotifyLyrics] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<SettingsAnchor | null>(null);
  const [replacementHost, setReplacementHost] = useState<HTMLElement | null>(null);
  const [lyricsDomVersion, setLyricsDomVersion] = useState(0);

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
      setHasUnsyncedSpotifyLyrics(hasUnsyncedSpotifyLyricsNotice());
      setLyricsDomVersion((version) => version + 1);
    };

    syncPlaybackState();

    const intervalId = window.setInterval(syncPlaybackState, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return {
    spotifyActiveLineIndex,
    spotifyLyricsLines,
    currentTrack,
    playbackPositionMs,
    setPlaybackPositionMs,
    hasUnsyncedSpotifyLyrics,
    settingsAnchor,
    replacementHost,
    lyricsDomVersion,
  };
}
