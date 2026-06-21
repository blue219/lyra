import type { CSSProperties } from 'react';

import type { OverlayPhase } from './lyrics-flow';
import settingsIconUrl from '../../assets/branding/toolbar/lyra-toolbar-green-transparent.png';
import { SettingsPanel } from '../settings/settings-panel';
import type { LyricsResult, OverlaySettings } from '../../shared/types';

export interface SettingsAnchor {
  right: number;
  top: number;
}

interface SettingsEntryProps {
  anchor: SettingsAnchor | null;
  isOpen: boolean;
  lyrics: LyricsResult;
  phase: OverlayPhase;
  settings: OverlaySettings;
  onOpenChange: (isOpen: boolean) => void;
  onSettingsChange: (patch: Partial<OverlaySettings>) => void;
}

export function SettingsEntry({
  anchor,
  isOpen,
  lyrics,
  phase,
  settings,
  onOpenChange,
  onSettingsChange,
}: SettingsEntryProps) {
  return (
    <div
      className="fixed z-[2147483647] flex flex-col items-end pr-[10px] font-[var(--lyra-font-ui)] text-[var(--lyra-color-text)]"
      style={getSettingsEntryStyle(anchor)}
    >
      <button
        aria-label="Open Lyra settings"
        className={[
          'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[rgba(18,18,18,0.72)] p-1 text-[var(--lyra-color-accent)] antialiased shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_6px_18px_rgba(0,0,0,0.26)] transition hover:border-[var(--lyra-color-accent)]/35 hover:bg-[rgba(18,18,18,0.86)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_22px_rgba(0,0,0,0.32)]',
          isOpen ? 'ring-2 ring-[var(--lyra-color-accent)]/30' : '',
        ].join(' ')}
        type="button"
        onClick={() => onOpenChange(!isOpen)}
      >
        <img
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
          src={settingsIconUrl}
        />
      </button>

      {isOpen ? (
        <div className="relative mt-3 w-[min(88vw,274px)]">
          <div
            aria-hidden="true"
            data-lyra-settings-notch="true"
            className="absolute -top-[3px] right-[14px] h-4 w-4 rotate-45 border-t border-l border-white/12 bg-[rgba(24,24,24,0.96)]"
          />
          <SettingsPanel
            footerText={getPhaseLabel(phase, lyrics)}
            settings={settings}
            onSettingsChange={onSettingsChange}
            variant="overlay"
          />
        </div>
      ) : null}
    </div>
  );
}

export function readSettingsAnchor(container: HTMLElement | null): SettingsAnchor | null {
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

export function getSettingsEntryStyle(anchor: SettingsAnchor | null): CSSProperties {
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

export function getPhaseLabel(phase: OverlayPhase, lyrics: LyricsResult): string {
  if (phase === 'loading-lyrics') {
    return 'Loading synced lyrics.';
  }

  if (phase === 'loading-translation') {
    return 'Loading lyric translation.';
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
