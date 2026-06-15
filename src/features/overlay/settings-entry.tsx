import type { CSSProperties } from 'react';

import type { OverlayPhase } from './lyrics-flow';
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

const languageOptions = [
  { value: 'en-US', label: 'English' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
];

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
      className="fixed z-[2147483647] font-[var(--lyra-font-ui)] text-[var(--lyra-color-text)]"
      style={getSettingsEntryStyle(anchor)}
    >
      <button
        aria-label="Open Lyra settings"
        className={[
          'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[var(--lyra-color-surface-2)] text-sm font-black text-[var(--lyra-color-accent)] shadow-[var(--lyra-shadow-elevated)] transition hover:border-white/30',
          isOpen ? 'ring-2 ring-[var(--lyra-color-accent)]/50' : '',
        ].join(' ')}
        type="button"
        onClick={() => onOpenChange(!isOpen)}
      >
        L
      </button>

      {isOpen ? (
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
                onSettingsChange({ targetLanguage: event.target.value })
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
                  onClick={() => onSettingsChange({ fontSize })}
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
