# Lyra Development Notes

## MVP behavior

Lyra injects a content script into `https://open.spotify.com/*`, but it does not inject translated text into Spotify's native lyric rows. On Spotify's lyrics page, Lyra visually disables Spotify's native lyrics UI, keeps the native DOM available only as a data and active-line sync source, and renders its own React replacement lyrics page in the same lyrics area. If Spotify lyrics are unavailable or Spotify marks them as unsynced, Lyra falls back to synced LRCLIB lyrics for the current track.

The current self-hosted LibreTranslate service supports English and Simplified Chinese. If translation is unavailable, missing an API key, or fails, Spotify's original lyrics remain unchanged.

## Manual loading

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `VITE_LIBRETRANSLATE_BASE_URL` to your LibreTranslate-compatible backend.
4. Set `VITE_LIBRETRANSLATE_API_KEY`.
5. Run `npm run dev`.
6. Open your existing Chrome window and visit `chrome://extensions`.
7. Enable developer mode.
8. Load the unpacked extension from `.output/chrome-mv3`.
9. Open Spotify Web Player, open Spotify's lyrics view, and verify Lyra-rendered lyrics replace the native lyric text after lyrics are visible.

`npm run dev` uses WXT's manual runner so development happens inside your own Chrome session.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start WXT development mode on port `5173`. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run compile` | Run TypeScript without emitting files. |
| `npm run build` | Build the production extension bundle. |
| `npm run zip` | Create a distributable extension zip through WXT. |

## Configuration

Lyra reads Vite environment variables from `.env`.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `VITE_LIBRETRANSLATE_BASE_URL` | Yes for translation | None | Must point to a LibreTranslate-compatible service reachable from the extension. |
| `VITE_LIBRETRANSLATE_API_KEY` | Yes for translation | None | Missing keys make Lyra show original lyrics without translation. |

The extension manifest grants `storage`, `https://lrclib.net/*`, and `http://localhost:5000/*` for local LibreTranslate development. During local builds, `wxt.config.ts` also reads `VITE_LIBRETRANSLATE_BASE_URL` from `.env` and adds that host to the generated extension permissions without committing the private URL.

## Manual smoke checklist

- Lyra's replacement lyrics page renders only on Spotify Web Player's lyrics page.
- Visible Spotify lyrics are the preferred source and are translated through LibreTranslate.
- Spotify lyrics that show the "These lyrics aren't synced to the song yet." notice fall back to LRCLIB when track metadata is available.
- Native Spotify lyric text is visually hidden while Lyra's own original and translated lyric page appears in the same lyrics area.
- Lyra shows a small English source label above the lyrics: `Source: Native`, `Source: LRCLIB`, or `No lyrics available`.
- Lyra's replacement lyrics area can be manually scrolled and automatically centers the active lyric line during playback.
- Lyra replacement lyric lines show a pointer cursor and can be clicked to switch Lyra's active line. LRCLIB fallback lines also seek playback by their synced timestamp.
- After lyric-line clicks, Lyra returns highlight control to synced playback and keeps the replacement lyrics view in front of the native Spotify page.
- The Lyra settings icon appears in the top-right corner when Spotify lyrics are visible.
- When Spotify lyrics are not available but the current track is readable, Lyra requests synced LRCLIB fallback lyrics.
- Lyra waits for persisted settings before the first lyrics request so LRCLIB fallback uses the saved target language immediately.
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

## Spotify lyrics replacement behavior

Lyra does not click Spotify controls or open the lyrics panel automatically. On Spotify's lyrics page, it reads lyric lines already present in the page DOM, keeps those native nodes available for Spotify's own sync behavior, and visually hides or disables the native lyrics UI while Lyra renders its own replacement lyrics page.

Spotify lyric lines do not expose LRCLIB-style timestamps in the extension. For Spotify-sourced lyrics, Lyra uses Spotify's native active-line signal to highlight and scroll the replacement lyrics.

The implementation lives in `entrypoints/content/index.tsx` and `src/features/overlay/content-app.tsx`:

- `entrypoints/content/index.tsx` mounts a WXT shadow-root UI and injects CSS that makes native Spotify lyric text transparent.
- `ContentApp` creates a `data-lyra-replacement-host` element inside the Spotify lyrics container.
- `ReplacementLyrics` renders Lyra's own lyric page into that host through a React portal.
- The native Spotify lyrics DOM remains in the document so Lyra can read visible lines and active-line changes, but users interact with Lyra's replacement UI.

## LRCLIB fallback behavior

LRCLIB support remains available in the background lyrics API. The content script calls it when Spotify lyrics are not available on the lyrics page but the current Spotify track can be read. See `docs/lrclib-api.md` for endpoint examples and integration details.

LRCLIB lookup uses LRCLIB search with track and artist first, then track-only search if no artist-constrained match is found. Each LRCLIB HTTP request retries transient failures up to two extra times with 200ms and 400ms backoff for network errors, HTTP 429, and HTTP 5xx responses. The selected synced lyrics are parsed as original text, cleaned of ASS/SSA style override tags, and translated through LibreTranslate. Non-retryable 4xx responses and invalid payloads fail immediately and fall through to the normal unavailable result path.

## Lyrics cache behavior

Lyra caches lyrics in the background service worker and persists valid entries to `chrome.storage.local` under `lyricsCache`. Cache hydration is awaited before the first lyrics request checks the cache, so service worker restarts can reuse stored entries before refetching.

The cache keeps up to 200 recently used entries with LRU eviction. Successful bilingual results and normal monolingual results are cached for 30 minutes. Unavailable results are cached for 5 minutes. Monolingual results produced while a target language is selected, but without a matching source language, are treated as translation degradation and cached for 2 minutes so Lyra retries translation soon after temporary service failures.

Concurrent requests for the same cache key share one in-flight lyrics request. Spotify-sourced translation cache keys include the source, target language, and original lyric text. LRCLIB fallback cache keys include the normalized track identity and target language.

## Source language detection

Lyra detects the source language through the configured LibreTranslate backend before translation. It sends all lyric lines as one newline-separated `q` value to `POST /detect`, maps `en` to `en-US` and `zh-Hans` to `zh-CN`, and treats that value as the source language for the whole lyrics result. If detection fails, returns an unsupported language, or matches the selected target language, Lyra keeps showing original lyrics.

## LibreTranslate behavior

Lyra sends batched lyric lines to the configured self-hosted LibreTranslate backend separated by newlines so returned lines can be mapped back to lyric rows. The development backend preserves newlines, while some punctuation-like separators can be removed during translation. See `docs/libretranslate-api.md` for endpoint examples and integration details.

- `VITE_LIBRETRANSLATE_BASE_URL` must be set to enable translation.
- `VITE_LIBRETRANSLATE_API_KEY` is required for translation requests.
- The request body includes `q`, `source`, `target`, `format`, and `api_key`.
- Lyra sends `q` and `api_key` to `/detect` before translating.
- LibreTranslate `/detect` and `/translate` requests retry transient failures up to two extra times with 200ms and 400ms backoff for network errors, HTTP 429, and HTTP 5xx responses.
- Translated lyric text is cleaned of ASS/SSA style override tags before display.
- Pure musical marker lines such as `♪` keep the same marker as their translation.
- On missing API keys, unsupported languages, non-retryable 4xx responses, response format errors, or line-count mismatches, Lyra keeps showing original lyrics immediately.
- After transient retry attempts are exhausted for detection or translation, Lyra keeps showing original lyrics.

## Troubleshooting

- If no Lyra UI appears, confirm the extension is loaded from `.output/chrome-mv3`, the current page matches `https://open.spotify.com/*`, and Spotify's lyrics view is open.
- If original lyrics appear but translations do not, confirm `VITE_LIBRETRANSLATE_BASE_URL` and `VITE_LIBRETRANSLATE_API_KEY` are set and the configured LibreTranslate host is included in `wxt.config.ts` host permissions.
- If the extension stops responding after a development reload, refresh the Spotify tab so the current content script reconnects to the latest background service worker.
- If LRCLIB fallback never appears, confirm the current Spotify track title and artists are readable in the page and that `https://lrclib.net/*` requests are not blocked by the browser or network.
