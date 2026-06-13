# Lyra Development Notes

## MVP behavior

Lyra injects into `https://open.spotify.com/*` and renders its own lyrics view inside Spotify's lyrics page. When Spotify lyrics are available, Lyra keeps Spotify's native lyrics DOM as the preferred source for visible lyric text and active-line sync, visually hides the native text, translates those lines through the configured LibreTranslate backend, and renders original plus translated lines in the same page area. If Spotify lyrics are not available, Lyra falls back to synced LRCLIB lyrics for the current track.

The current translation service supports English and Simplified Chinese. If translation is unavailable, missing an API key, or fails, Spotify's original lyrics remain unchanged.

## Manual loading

1. Run `npm install`.
2. Copy `.env.example` to `.env` and set `VITE_LIBRETRANSLATE_API_KEY`.
3. Run `npm run dev`.
4. Open your existing Chrome window and visit `chrome://extensions`.
5. Enable developer mode.
6. Load the unpacked extension from `.output/chrome-mv3`.
7. Open Spotify Web Player, open Spotify's lyrics view, and verify Lyra-rendered lyrics replace the native lyric text after lyrics are visible.

`npm run dev` uses WXT's manual runner so development happens inside your own Chrome session.

## Manual smoke checklist

- Lyra lyrics render only on Spotify Web Player's lyrics page.
- Visible Spotify lyrics are the preferred source and are translated through LibreTranslate.
- Native Spotify lyric text is visually hidden while Lyra-rendered original and translated lines appear in the same lyrics page area.
- Lyra's replacement lyrics area can be manually scrolled and automatically centers the active lyric line during playback.
- The Lyra settings icon appears in the top-right corner when Spotify lyrics are visible.
- When Spotify lyrics are not available but the current track is readable, Lyra requests synced LRCLIB fallback lyrics.
- Monolingual, translated, and unavailable lyric states remain readable.
- English and Simplified Chinese target language settings persist across refresh.
- Font size settings persist across refresh.

## Code organization

Lyra keeps extension entrypoints in `entrypoints/` and feature code in `src/features/`.

- `overlay`: lyrics page replacement rendering, settings entry UI, and content-script state orchestration.
- `spotify`: Spotify Web Player DOM readers and track identity helpers.
- `lyrics`: synced lyric parsing, LRCLIB fallback, lyrics cache, and runtime messages.
- `translation`: LibreTranslate request and response handling.
- `settings`: inline lyric settings defaults and validation.
- `shared`: cross-feature types and browser extension API helpers.

## Spotify lyrics behavior

Lyra does not click Spotify controls or open the lyrics panel automatically. On Spotify's lyrics page, it reads lyric lines already present in the page DOM, keeps those native nodes available for Spotify's own sync behavior, and visually hides their text while Lyra renders its replacement lyrics view.

Spotify lyric lines do not expose LRCLIB-style timestamps in the extension. For Spotify-sourced lyrics, Lyra uses Spotify's native active-line signal to highlight and scroll the replacement lyrics.

## LRCLIB fallback behavior

LRCLIB support remains available in the background lyrics API. The content script calls it when Spotify lyrics are not available on the lyrics page but the current Spotify track can be read.

LRCLIB lookup uses LRCLIB search with track and artist first, then track-only search if no artist-constrained match is found. The selected synced lyrics are parsed as original text, cleaned of ASS/SSA style override tags, and translated through LibreTranslate.

## Lyrics cache behavior

Lyra caches lyrics in the background service worker and persists valid entries to `chrome.storage.local` under `lyricsCache`. Cache hydration is awaited before the first lyrics request checks the cache, so service worker restarts can reuse stored entries before refetching.

The cache keeps up to 200 recently used entries with LRU eviction. Successful bilingual results and normal monolingual results are cached for 30 minutes. Unavailable results are cached for 5 minutes. Monolingual results produced while a target language is selected, but without a matching source language, are treated as translation degradation and cached for 2 minutes so Lyra retries translation soon after temporary service failures.

Concurrent requests for the same cache key share one in-flight lyrics request. Spotify-sourced translation cache keys include the source, target language, and original lyric text. LRCLIB fallback cache keys include the normalized track identity and target language.

## Source language detection

Lyra detects the source language through the configured LibreTranslate backend before translation. It sends all lyric lines as one newline-separated `q` value to `POST /detect`, maps `en` to `en-US` and `zh-Hans` to `zh-CN`, and treats that value as the source language for the whole lyrics result. If detection fails, returns an unsupported language, or matches the selected target language, Lyra keeps showing original lyrics.

## LibreTranslate behavior

Lyra sends batched lyric lines to the configured LibreTranslate backend separated by newlines so returned lines can be mapped back to lyric rows. The development backend preserves newlines, while some punctuation-like separators can be removed during translation.

- Base URL defaults to `http://154.44.10.127:5000`.
- `VITE_LIBRETRANSLATE_BASE_URL` can override the base URL.
- `VITE_LIBRETRANSLATE_API_KEY` is required for translation requests.
- The request body includes `q`, `source`, `target`, `format`, and `api_key`.
- Lyra sends `q` and `api_key` to `/detect` before translating.
- Translated lyric text is cleaned of ASS/SSA style override tags before display.
- Pure musical marker lines such as `♪` keep the same marker as their translation.
- On detection errors, network errors, non-2xx responses, response format errors, or line-count mismatches, Lyra keeps showing original lyrics.
