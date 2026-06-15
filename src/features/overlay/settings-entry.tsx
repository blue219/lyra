import type { CSSProperties } from 'react';

import type { OverlayPhase } from './lyrics-flow';
import type { LyricsResult, OverlaySettings } from '../../shared/types';
import settingsIconUrl from '../../assets/branding/toolbar/lyra-toolbar-green-transparent.png';

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
        <section className="relative mt-3 w-[min(88vw,274px)] rounded-[24px] border border-white/12 bg-[rgba(24,24,24,0.96)] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.3)]">
          <div
            aria-hidden="true"
            data-lyra-settings-notch="true"
            className="absolute -top-[3px] right-[14px] h-4 w-4 rotate-45 border-t border-l border-white/12 bg-[rgba(24,24,24,0.96)]"
          />
          <div>
            <label
              className="text-[10px] font-bold uppercase tracking-[4px] text-white/70"
              htmlFor="lyra-target-language"
            >
              Target language
            </label>
            <select
              className="mt-3 w-full rounded-[999px] border border-white/20 bg-[rgba(25,25,25,0.92)] px-4 py-3 text-[0.82rem] font-medium text-white outline-none transition"
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

          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[4px] text-white/70">
              Font size
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {(['sm', 'md', 'lg'] as const).map((fontSize) => (
                <button
                  key={fontSize}
                  className={[
                    'rounded-[999px] border px-3 py-2 text-[0.78rem] font-bold uppercase tracking-[2px] transition',
                    settings.fontSize === fontSize
                      ? 'border-[var(--lyra-color-accent)] bg-[var(--lyra-color-accent)] text-black shadow-[0_4px_14px_rgba(30,215,96,0.2)]'
                      : 'border-white/25 bg-transparent text-white hover:border-white/50',
                  ].join(' ')}
                  type="button"
                  onClick={() => onSettingsChange({ fontSize })}
                >
                  {fontSize.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-5 text-[0.8rem] leading-5 text-white/68">
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
