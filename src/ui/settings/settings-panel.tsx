import { useEffect, useRef, useState } from 'react';

import { supportedLanguages } from '@/src/domain/languages';
import type { CacheSummary, OverlaySettings } from '@/src/domain/model';

interface SettingsPanelProps {
  cacheSummary: CacheSummary;
  isCachePending: boolean;
  isClearingCache: boolean;
  settings: OverlaySettings;
  onClearCache: () => void;
  onSettingsChange: (patch: Partial<OverlaySettings>) => void;
  errorMessage?: string | null;
  onRetry?: () => void;
  variant?: 'overlay' | 'popup';
}

const languageOptions = supportedLanguages.map(({ value, label }) => ({
  value,
  label,
}));

const contactEmail = 'lantianisbluesky@gmail.com';

export function SettingsPanel({
  cacheSummary,
  isCachePending,
  isClearingCache,
  settings,
  onClearCache,
  onSettingsChange,
  errorMessage,
  onRetry,
  variant = 'overlay',
}: SettingsPanelProps) {
  const isPopup = variant === 'popup';
  const [didCopyEmail, setDidCopyEmail] = useState(false);
  const copiedMessageTimeout = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedMessageTimeout.current !== null) {
        window.clearTimeout(copiedMessageTimeout.current);
      }
    };
  }, []);

  async function copyContactEmail() {
    try {
      await navigator.clipboard.writeText(contactEmail);
    } catch {
      return;
    }

    if (copiedMessageTimeout.current !== null) {
      window.clearTimeout(copiedMessageTimeout.current);
    }

    setDidCopyEmail(true);
    copiedMessageTimeout.current = window.setTimeout(() => {
      setDidCopyEmail(false);
      copiedMessageTimeout.current = null;
    }, 1600);
  }

  return (
    <section
      className={[
        'w-full bg-[rgba(24,24,24,0.96)]',
        isPopup
          ? 'rounded-none border-none shadow-none'
          : 'rounded-[20px] border border-white/12 shadow-[0_12px_28px_rgba(0,0,0,0.3)]',
      ].join(' ')}
    >
      <header className="flex h-14 items-center justify-between px-4">
        <h2 className="text-[1.25rem] font-bold tracking-[-0.03em] text-white">
          Lyra
        </h2>
        <div className="flex items-center gap-2">
          <div className="group relative">
            <button
              aria-label="Copy contact email address"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/20 text-white transition hover:border-white/50 hover:bg-white/10"
              type="button"
              onClick={copyContactEmail}
            >
              <span className="relative block h-[18px] w-[18px]">
                <svg
                  aria-hidden="true"
                  className="absolute inset-0 h-[18px] w-[18px] transition-opacity duration-200 ease-out group-hover:opacity-0 group-focus-within:opacity-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3.5 6.5C3.5 5.67 4.17 5 5 5H19C19.83 5 20.5 5.67 20.5 6.5V17.5C20.5 18.33 19.83 19 19 19H5C4.17 19 3.5 18.33 3.5 17.5V6.5Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4.5 6L12 12L19.5 6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <svg
                  aria-hidden="true"
                  className="absolute inset-0 h-[18px] w-[18px] opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="8"
                    y="8"
                    width="11"
                    height="11"
                    rx="1.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M16 8V5.5C16 4.67 15.33 4 14.5 4H5.5C4.67 4 4 4.67 4 5.5V14.5C4 15.33 4.67 16 5.5 16H8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </button>
            <span
              className={[
                'pointer-events-none absolute top-full right-0 z-10 mt-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-[0.7rem] font-medium text-white shadow-[0_4px_12px_rgba(0,0,0,0.35)] transition-opacity',
                didCopyEmail
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
              ].join(' ')}
              role="status"
            >
              {didCopyEmail ? 'Copied' : contactEmail}
            </span>
          </div>
          <a
            aria-label="Open Lyra on GitHub"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/20 text-white transition hover:border-white/50 hover:bg-white/10"
            href="https://github.com/blue219/lyra"
            rel="noreferrer"
            target="_blank"
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C6.48 2 2 6.58 2 12.24c0 4.53 2.87 8.36 6.84 9.72.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.91-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.06-.63.06-.63 1 .08 1.53 1.05 1.53 1.05.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.15-4.56-5.1 0-1.13.39-2.05 1.03-2.78-.1-.26-.45-1.32.1-2.75 0 0 .84-.28 2.75 1.06A9.23 9.23 0 0 1 12 6.45c.85 0 1.71.12 2.51.35 1.91-1.34 2.75-1.06 2.75-1.06.55 1.43.2 2.49.1 2.75.64.73 1.03 1.65 1.03 2.78 0 3.96-2.35 4.84-4.58 5.1.36.32.68.94.68 1.9 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.49A10.26 10.26 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z" />
            </svg>
          </a>
        </div>
      </header>
      {errorMessage ? (
        <div
          className={[
            'rounded-xl bg-[#f3727f]/12 px-3 py-2 text-[0.76rem] text-[#f7a3ab]',
            'mx-4 mb-3',
          ].join(' ')}
          role="alert"
        >
          <span>{errorMessage}</span>{' '}
          {onRetry ? (
            <button
              className="font-bold underline"
              type="button"
              onClick={onRetry}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="relative flex min-h-14 items-center justify-between gap-4 border-t border-white/10 px-4 py-2.5">
        <label
          className="shrink-0 text-[0.82rem] font-bold text-white"
          htmlFor="lyra-target-language"
        >
          Language
        </label>
        <select
          className={[
            'cursor-pointer rounded-[14px] border border-white/30 bg-[rgba(25,25,25,0.92)] px-4 py-3 text-[0.82rem] font-medium text-white outline-none transition',
            'absolute top-1/2 right-4 w-[176px] shrink-0 -translate-y-1/2 py-2',
          ].join(' ')}
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

      <div className="flex min-h-14 items-center justify-between gap-4 border-t border-white/10 px-4 py-2.5">
        <p className="shrink-0 text-[0.82rem] font-bold text-white">
          Font size
        </p>
        <div className="grid grid-cols-3 gap-1 rounded-[14px] border border-white/30 bg-[rgba(25,25,25,0.92)] p-1">
          {(['sm', 'md', 'lg'] as const).map((fontSize) => (
            <button
              key={fontSize}
              className={[
                'cursor-pointer rounded-[10px] px-3 py-2 text-[0.78rem] font-bold uppercase tracking-[2px] transition',
                settings.fontSize === fontSize
                  ? 'bg-[var(--lyra-color-accent)] text-black shadow-[0_4px_14px_rgba(30,215,96,0.2)]'
                  : 'bg-transparent text-white hover:bg-white/10',
                'min-w-[45px]',
              ].join(' ')}
              type="button"
              onClick={() => onSettingsChange({ fontSize })}
            >
              {fontSize.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-14 items-center justify-between gap-4 border-t border-white/10 px-4 py-2.5">
        <div>
          <p className="text-[0.82rem] font-bold text-white">Dynamic</p>
        </div>
        <button
          aria-checked={settings.dynamicBackground}
          aria-label="Toggle dynamic background"
          className={[
            'relative h-7 w-12 shrink-0 cursor-pointer rounded-[999px] border transition',
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
              'absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.28)] transition',
              settings.dynamicBackground ? 'right-1' : 'left-1',
            ].join(' ')}
          />
        </button>
      </div>

      <div className="flex min-h-14 items-center justify-between gap-4 border-t border-white/10 px-4 py-2.5">
        <p className="text-[0.82rem] font-bold text-white">Cache</p>

        <div className="text-right text-[0.78rem] font-medium text-white/68">
          <span>
            {isCachePending
              ? '-- entries · --'
              : `${cacheSummary.entryCount}/${cacheSummary.maxEntries} entries · ${formatBytes(cacheSummary.sizeBytes)}`}
          </span>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-4">
        <button
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[16px] border border-[#ff1010] bg-transparent px-4 py-2.5 text-[0.82rem] font-bold text-[#ff1010] transition hover:bg-[#ff1010]/10 disabled:cursor-not-allowed disabled:opacity-50"
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
          <span>{isClearingCache ? 'Clearing' : 'Clear cache'}</span>
        </button>
      </div>
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
