# Lyra Development Notes

## MVP behavior

Lyra injects a content script into `https://open.spotify.com/*`, but it does not inject translated text into Spotify's native lyric rows. On Spotify's lyrics page, Lyra visually disables Spotify's native lyrics UI, keeps the native DOM available only as a data and active-line sync source, and renders its own React replacement lyrics page in the same lyrics area. If Spotify lyrics are unavailable or Spotify marks them as unsynced, Lyra falls back to synced LRCLIB lyrics for the current track.

Translation uses Google Translate's web endpoint first, then falls back to Microsoft Translator and Bing Translator web endpoints for failed lyric chunks. If no provider can preserve lyric line boundaries, Spotify's original lyrics remain unchanged.

## Manual loading

1. Run `npm install`.
2. Run `npm run dev`.
3. Open your existing Chrome window and visit `chrome://extensions`.
4. Enable developer mode.
5. Load the unpacked extension from `.output/chrome-mv3-dev`.
6. Open Spotify Web Player, open Spotify's lyrics view, and verify Lyra-rendered lyrics replace the native lyric text after lyrics are visible.

`npm run dev` uses WXT's manual runner so development happens inside your own Chrome session. Use `.output/chrome-mv3` only after running `npm run build` for a production bundle.

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

Lyra does not require local environment variables for translation.

The extension manifest grants `storage`, `https://lrclib.net/*`, `https://translate.googleapis.com/*`, `https://translator.bing.com/*`, and `https://www.bing.com/*`.

## Manual smoke checklist

- Lyra's replacement lyrics page renders only on Spotify Web Player's lyrics page.
- Visible Spotify lyrics are the preferred source and are translated through the provider chain.
- Spotify lyrics that show the "These lyrics aren't synced to the song yet." notice fall back to LRCLIB when track metadata is available.
- Native Spotify lyric text is visually hidden while Lyra's own original and translated lyric page appears in the same lyrics area.
- Lyra's replacement lyrics page keeps a non-interactive aurora background behind the lyrics content. The dynamic WebGL layer can be disabled in settings and falls back to a static gradient when WebGL is unavailable, the page is hidden, or reduced motion is preferred.
- Lyra shows a small English source label above the lyrics: `Source: Native`, `Source: LRCLIB`, or `No lyrics available`.
- Lyra's replacement lyrics area can be manually scrolled and automatically centers the active lyric line during playback.
- Lyra replacement lyric lines show a pointer cursor and can be clicked to switch Lyra's active line. LRCLIB fallback lines also seek playback by their synced timestamp.
- After lyric-line clicks, Lyra returns highlight control to synced playback and keeps the replacement lyrics view in front of the native Spotify page.
- The Lyra settings icon appears in the top-right corner when Spotify lyrics are visible.
- When Spotify lyrics are not available but the current track is readable, Lyra requests synced LRCLIB fallback lyrics.
- Lyra waits for persisted settings before the first lyrics request so LRCLIB fallback uses the saved target language immediately.
- Monolingual, translated, and unavailable lyric states remain readable.
- Supported target language settings persist across refresh.
- Font size settings persist across refresh.
- Dynamic background preference persists across refresh.

## Code organization

Lyra keeps extension entrypoints in `entrypoints/` and feature code in `src/features/`.

- `overlay`: lyrics page replacement rendering, settings entry UI, and content-script state orchestration.
- `spotify`: Spotify Web Player DOM readers and track identity helpers.
- `lyrics`: synced lyric parsing, LRCLIB fallback, lyrics cache, and runtime messages.
- `translation`: translation provider orchestration, request handling, response parsing, and degradation behavior.
- `settings`: inline lyric settings defaults and validation.
- `shared`: cross-feature types, supported language registry, and browser extension API helpers.

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

LRCLIB lookup uses LRCLIB search with track and artist first, then track-only search if no artist-constrained match is found. Each LRCLIB HTTP request retries transient failures up to two extra times with 200ms and 400ms backoff for network errors, HTTP 429, and HTTP 5xx responses. The selected synced lyrics are parsed as original text, cleaned of ASS/SSA style override tags, and translated through the normal translation provider chain. Non-retryable 4xx responses and invalid payloads fail immediately and fall through to the normal unavailable result path.

## Lyrics cache behavior

Lyra caches lyrics in the background service worker and persists valid entries to `chrome.storage.local` under `lyricsCache`. Cache hydration is awaited before the first lyrics request checks the cache, so service worker restarts can reuse stored entries before refetching.

The cache keeps up to 200 recently used entries with LRU eviction. Successful bilingual results and normal monolingual results are cached for 30 minutes. Confirmed unavailable results, such as not-found or instrumental LRCLIB results, are cached for 5 minutes. Transient unavailable results from network, rate-limit, provider, or invalid-response failures are cached for 1 minute. Monolingual results produced while a target language is selected, but without a matching source language, are treated as translation degradation and cached for 2 minutes so Lyra retries translation soon after temporary service failures.

Concurrent requests for the same cache key share one in-flight lyrics request. Spotify-sourced translation cache keys include the source, target language, line count, and a short hash of the original lyric text, so raw lyrics are not duplicated in the cache key. LRCLIB fallback cache keys keep original lyrics under the normalized track identity and translated results under the normalized track identity plus target language, so switching languages can reuse the same LRCLIB original lyrics.

## Source language detection

Translation providers return the detected source language as part of their responses. Lyra maps supported detected language codes back to overlay language values and treats that value as the source language for the whole lyrics result. If a lyrics result already has a supported source language that matches the selected target language, Lyra skips translation requests and keeps showing original lyrics. If detection fails, returns an unsupported language, matches the selected target language after a provider request, or returns text that matches the original lyric text, Lyra keeps showing original lyrics.

## Translation provider behavior

Lyra calls Google Translate's web endpoint first with `client=gtx`, `sl=auto`, and the selected target language. Failed Google chunks fall back to Microsoft Translator through `https://translator.bing.com/`, then Bing Translator through `https://www.bing.com/translator`. Lyra inserts a stable sentinel line separator inside each request and only accepts a translated chunk when it can be split back into the same number of lyric lines.

- Translation providers do not require local environment variables.
- The web endpoints are unofficial and may change, become rate limited, or fail without notice.
- If the existing source language already matches the target language, Lyra skips provider requests.
- If the detected source language matches the target language, Lyra keeps the original lyrics.
- If translated text matches the original lyric text, Lyra hides that duplicate translation and does not cache all-duplicate translation results.
- If a chunk's response format is unexpected, line counts mismatch, a single lyric line is too long for the translation limit, or no usable translation is returned by any provider, Lyra keeps the original lyrics for that chunk.
- Translated lyric text is cleaned of ASS/SSA style override tags before display.
- Pure musical marker lines such as `♪` keep the same marker as their translation.
- On unsupported languages, request failures, response format errors, or line-count mismatches, Lyra keeps showing original lyrics.

## Troubleshooting

- If no Lyra UI appears, confirm the extension is loaded from `.output/chrome-mv3-dev` during development or from `.output/chrome-mv3` after `npm run build`, the current page matches `https://open.spotify.com/*`, and Spotify's lyrics view is open.
- If original lyrics appear but translations do not, check whether `https://translate.googleapis.com/*`, `https://translator.bing.com/*`, or `https://www.bing.com/*` requests are blocked.
- If the extension stops responding after a development reload, refresh the Spotify tab so the current content script reconnects to the latest background service worker.
- If LRCLIB fallback never appears, confirm the current Spotify track title and artists are readable in the page and that `https://lrclib.net/*` requests are not blocked by the browser or network.
