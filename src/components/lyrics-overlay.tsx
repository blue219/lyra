import { getLineTranslationForLanguage } from '../lib/lyrics';
import type { LyricsResult, OverlaySettings, TrackIdentity } from '../lib/types';

interface LyricsOverlayProps {
  activeLineIndex: number;
  lyrics: LyricsResult;
  phase: 'waiting-track' | 'loading' | 'ready' | 'unavailable' | 'error';
  settings: OverlaySettings;
  settingsOpen: boolean;
  track: TrackIdentity | null;
  onSettingsChange: (patch: Partial<OverlaySettings>) => void;
  onToggleSettings: () => void;
}

const languageOptions = [
  { value: 'en-US', label: 'English' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'zh-TW', label: 'Chinese (Traditional)' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'es-ES', label: 'Spanish' },
];

const fontSizeClassNames: Record<OverlaySettings['fontSize'], string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

const positionClassNames: Record<OverlaySettings['position'], string> = {
  left: 'left-4 top-4 sm:left-6 sm:top-6',
  right: 'right-4 top-4 sm:right-6 sm:top-6',
  bottom:
    'bottom-24 left-1/2 w-[min(90vw,720px)] -translate-x-1/2 sm:bottom-28',
};

export function LyricsOverlay({
  activeLineIndex,
  lyrics,
  phase,
  settings,
  settingsOpen,
  track,
  onSettingsChange,
  onToggleSettings,
}: LyricsOverlayProps) {
  const panelWidthClassName =
    settings.position === 'bottom' ? '' : 'w-[min(92vw,380px)] sm:w-[380px]';

  return (
    <aside
      className={[
        'fixed z-[2147483647] rounded-[24px] border border-white/10 bg-[var(--lyra-color-surface)] text-[var(--lyra-color-text)] shadow-[var(--lyra-shadow-dialog)] backdrop-blur-sm',
        'max-sm:bottom-24 max-sm:left-1/2 max-sm:w-[min(92vw,720px)] max-sm:-translate-x-1/2 max-sm:top-auto',
        panelWidthClassName,
        positionClassNames[settings.position],
      ].join(' ')}
    >
      <div className="rounded-[inherit] bg-[linear-gradient(180deg,rgba(31,31,31,0.98)_0%,rgba(24,24,24,0.98)_100%)] p-4 sm:p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[2px] text-[var(--lyra-color-muted)]">
              Lyra
            </p>
            <h2 className="mt-2 truncate font-[var(--lyra-font-title)] text-[1.13rem] font-bold leading-tight text-white">
              {track?.title ?? 'Waiting for Spotify playback'}
            </h2>
            <p className="mt-1 truncate text-sm text-[var(--lyra-color-muted)]">
              {track?.artists.join(', ') ?? 'Play a track in Spotify Web Player'}
            </p>
          </div>

          <button
            className="shrink-0 rounded-full border border-[var(--lyra-color-border)] bg-[var(--lyra-color-surface-2)] px-4 py-2 text-[10px] font-bold uppercase tracking-[1.8px] text-white transition hover:border-white"
            type="button"
            onClick={onToggleSettings}
          >
            {settingsOpen ? 'Close' : 'Settings'}
          </button>
        </header>

        {settingsOpen ? (
          <section className="mt-4 space-y-3 rounded-[18px] bg-[var(--lyra-color-card)] p-4 shadow-[var(--lyra-shadow-elevated)]">
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
              <p className="mt-2 text-xs text-[var(--lyra-color-muted)]">
                Used when LRCLIB lines already contain an embedded translation.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[2px] text-[var(--lyra-color-muted)]">
                Font size
              </p>
              <div className="mt-2 flex gap-2">
                {(['sm', 'md', 'lg'] as const).map((fontSize) => (
                  <button
                    key={fontSize}
                    className={[
                      'flex-1 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[1.8px] transition',
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

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[2px] text-[var(--lyra-color-muted)]">
                Position
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['left', 'right', 'bottom'] as const).map((position) => (
                  <button
                    key={position}
                    className={[
                      'rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[1.8px] transition',
                      settings.position === position
                        ? 'bg-[var(--lyra-color-accent)] text-black'
                        : 'border border-[var(--lyra-color-border)] bg-[var(--lyra-color-surface-2)] text-white hover:border-white',
                    ].join(' ')}
                    type="button"
                    onClick={() => onSettingsChange({ position })}
                  >
                    {position}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-4 rounded-[20px] bg-[rgba(18,18,18,0.84)] p-4 shadow-[var(--lyra-shadow-elevated)]">
          <StatusBanner lyrics={lyrics} phase={phase} settings={settings} />

          <div className="lyra-scrollbar mt-4 max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {phase === 'waiting-track' ? (
              <EmptyState
                body="Start playback in Spotify Web Player and Lyra will attach to the current track."
                title="No active track"
              />
            ) : null}

            {phase === 'loading' ? (
              <EmptyState
                body="Fetching synced lyrics from LRCLIB for the current track."
                title="Loading lyrics"
              />
            ) : null}

            {phase === 'error' ? (
              <EmptyState
                body="The LRCLIB request failed. Lyra will retry automatically when the track changes."
                title="Lyrics request failed"
              />
            ) : null}

            {phase === 'unavailable' ? (
              <EmptyState
                body="No synced LRCLIB lyrics were found for this track."
                title="Lyrics unavailable"
              />
            ) : null}

            {phase === 'ready'
              ? lyrics.lines.map((line, index) => {
                  const isActive = index === activeLineIndex;
                  const translatedLine = getLineTranslationForLanguage(
                    line,
                    settings.targetLanguage,
                  );

                  return (
                    <article
                      key={`${line.timeMs}-${index}`}
                      className={[
                        'rounded-[18px] border px-4 py-3 transition',
                        isActive
                          ? 'border-[var(--lyra-color-accent)] bg-[rgba(30,215,96,0.12)] shadow-[0_0_0_1px_rgba(30,215,96,0.2)_inset]'
                          : 'border-white/5 bg-white/[0.03]',
                      ].join(' ')}
                    >
                      <p
                        className={[
                          'font-medium leading-[1.35] text-white',
                          fontSizeClassNames[settings.fontSize],
                        ].join(' ')}
                      >
                        {line.original || '\u00a0'}
                      </p>
                      {translatedLine ? (
                        <p className="mt-2 text-sm leading-[1.45] text-[var(--lyra-color-muted)]">
                          {translatedLine}
                        </p>
                      ) : null}
                    </article>
                  );
                })
              : null}
          </div>
        </section>
      </div>
    </aside>
  );
}

interface EmptyStateProps {
  title: string;
  body: string;
}

function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5">
      <p className="font-[var(--lyra-font-title)] text-base font-bold text-white">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--lyra-color-muted)]">
        {body}
      </p>
    </div>
  );
}

interface StatusBannerProps {
  phase: LyricsOverlayProps['phase'];
  lyrics: LyricsResult;
  settings: OverlaySettings;
}

function StatusBanner({ phase, lyrics, settings }: StatusBannerProps) {
  if (phase === 'ready' && lyrics.status === 'bilingual') {
    return (
      <div className="rounded-full bg-[rgba(30,215,96,0.14)] px-4 py-2 text-[10px] font-bold uppercase tracking-[1.8px] text-[var(--lyra-color-accent)]">
        Bilingual lines detected
      </div>
    );
  }

  if (phase === 'ready' && lyrics.status === 'monolingual') {
    return (
      <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-[1.8px] text-[var(--lyra-color-muted)]">
        Translation unavailable for {settings.targetLanguage}
      </div>
    );
  }

  return (
    <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-[1.8px] text-[var(--lyra-color-muted)]">
      Spotify-aligned overlay
    </div>
  );
}
