import { useEffect, useState } from 'react';

import type { LyricsResult } from '../../shared/types';
import {
  createLyricsRequestKey,
  emptyLyricsResult,
  loadLyricsSelection,
  shouldStartLyricsRequest,
  type LyricsRequestSelection,
  type OverlayPhase,
} from './lyrics-flow';

export function useLoadedLyrics({
  selection,
  targetLanguage,
  settingsLoaded,
}: {
  selection: LyricsRequestSelection;
  targetLanguage: string;
  settingsLoaded: boolean;
}) {
  const [lyrics, setLyrics] = useState<LyricsResult>(emptyLyricsResult);
  const [phase, setPhase] = useState<OverlayPhase>('waiting-track');
  const lyricsRequestKey = createLyricsRequestKey(
    selection,
    targetLanguage,
    settingsLoaded,
  );

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    if (
      !shouldStartLyricsRequest({
        selection,
        settingsLoaded,
      })
    ) {
      setLyrics(emptyLyricsResult);
      setPhase('waiting-track');
      return;
    }

    let isCancelled = false;

    loadLyricsSelection({
      selection,
      targetLanguage,
      onPhaseChange: ({ phase: nextPhase, lyrics: nextLyrics }) => {
        if (isCancelled) {
          return;
        }

        setLyrics(nextLyrics);
        setPhase(nextPhase);
      },
    })
      .then(({ phase: nextPhase, lyrics: nextLyrics }) => {
        if (isCancelled) {
          return;
        }

        setLyrics(nextLyrics);
        setPhase(nextPhase);
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

  return {
    lyrics,
    phase,
    lyricsRequestKey,
  };
}
