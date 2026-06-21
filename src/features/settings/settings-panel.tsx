import { supportedLanguages } from '../../shared/supported-languages';
import type { CacheSummary, OverlaySettings } from '../../shared/types';

interface SettingsPanelProps {
  cacheSummary: CacheSummary;
  footerText: string;
  isCachePending: boolean;
  isClearingCache: boolean;
  settings: OverlaySettings;
  onClearCache: () => void;
  onSettingsChange: (patch: Partial<OverlaySettings>) => void;
  variant?: 'overlay' | 'popup';
}

const languageOptions = supportedLanguages.map(({ value, label }) => ({ value, label }));

export function SettingsPanel({
  cacheSummary,
  footerText,
  isCachePending,
  isClearingCache,
  settings,
  onClearCache,
  onSettingsChange,
  variant = 'overlay',
}: SettingsPanelProps) {
  const isPopup = variant === 'popup';

  return (
    <section
      className={[
        'w-full bg-[rgba(24,24,24,0.96)] p-4',
        isPopup
          ? 'rounded-none border-none shadow-none'
          : 'rounded-[24px] border border-white/12 shadow-[0_12px_28px_rgba(0,0,0,0.3)]',
      ].join(' ')}
    >
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
          onChange={(event) => onSettingsChange({ targetLanguage: event.target.value })}
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

      <div className="mt-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[4px] text-white/70">
            Dynamic background
          </p>
        </div>
        <button
          aria-checked={settings.dynamicBackground}
          aria-label="Toggle dynamic background"
          className={[
            'relative h-7 w-12 shrink-0 rounded-[999px] border transition',
            settings.dynamicBackground
              ? 'border-[var(--lyra-color-accent)] bg-[var(--lyra-color-accent)]/85'
              : 'border-white/25 bg-white/10',
          ].join(' ')}
          role="switch"
          type="button"
          onClick={() =>
            onSettingsChange({
              dynamicBackground: !settings.dynamicBackground,
            })
          }
        >
          <span
            aria-hidden="true"
            className={[
              'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.28)] transition',
              settings.dynamicBackground ? 'left-[22px]' : 'left-1',
            ].join(' ')}
          />
        </button>
      </div>

      <div className="mt-6 rounded-[20px] bg-white/5 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[4px] text-white/70">
          Cache
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[0.78rem] font-medium text-white/68">
              Cached songs
            </span>
            <span className="text-[0.82rem] font-medium text-white">
              {isCachePending
                ? '--/--'
                : `${cacheSummary.songCount}/${cacheSummary.maxEntries}`}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-[0.78rem] font-medium text-white/68">
              Cache size
            </span>
            <span className="text-[0.82rem] font-medium text-white">
              {isCachePending ? '--' : formatBytes(cacheSummary.sizeBytes)}
            </span>
          </div>

          <div className="pt-1">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-[999px] bg-[#ff1010] px-4 py-3 text-[0.78rem] font-bold uppercase tracking-[2px] text-white transition hover:bg-[#ff2a2a] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isCachePending || isClearingCache}
              onClick={onClearCache}
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2.5 4.5H13.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M6 2.75H10"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M4.5 4.5L5.2 12.4C5.26 13.08 5.83 13.6 6.51 13.6H9.49C10.17 13.6 10.74 13.08 10.8 12.4L11.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6.75 6.75V11.1"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M9.25 6.75V11.1"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              <span>{isClearingCache ? 'Clearing' : 'Clear'}</span>
            </button>
          </div>
        </div>
      </div>

      <p className="mt-5 text-[0.8rem] leading-5 text-white/68">{footerText}</p>
    </section>
  );
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const sizeKb = sizeBytes / 1024;

  if (sizeKb < 10) {
    return `${sizeKb.toFixed(1)} KB`;
  }

  return `${Math.round(sizeKb)} KB`;
}
