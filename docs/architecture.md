# Lyra Architecture

This document describes the current extension structure and runtime data flow.

## Runtime overview

Lyra is a WXT Manifest V3 browser extension for Spotify Web Player.

- The content script runs on `https://open.spotify.com/*`.
- The content script mounts Lyra's React replacement lyrics page only when the user is on Spotify's lyrics page or when visible Spotify lyric rows are present.
- Lyra visually disables Spotify's native lyrics UI and keeps the native DOM available only as the source for lyric text and active-line synchronization.
- If Spotify lyrics are missing or Spotify marks them as unsynced, the overlay requests synced fallback lyrics from LRCLIB.
- Google translation and LRCLIB fallback are routed through the background service worker when the extension runtime is available.
- If the background service worker is unavailable during development reloads, the content code falls back to direct LRCLIB or translation calls where practical.

## Entry points

| File | Responsibility |
| --- | --- |
| `entrypoints/content/index.tsx` | Injects the content script, watches Spotify DOM changes, mounts or removes Lyra's replacement UI, and hides native lyric text while Lyra renders its own lyrics page. |
| `entrypoints/background.ts` | Handles lyrics, original lyrics, and translation runtime messages. It owns the persisted lyrics cache controller. |

## Feature modules

| Directory | Responsibility |
| --- | --- |
| `src/features/overlay` | React replacement lyrics page, settings entry, lyrics request orchestration, active-line selection, scroll behavior, and replacement rendering. |
| `src/features/spotify` | Spotify DOM readers, lyrics page detection, track identity extraction, active line detection, and playback seeking helpers. |
| `src/features/lyrics` | LRCLIB lookup, synced lyrics parsing, cache controller, and runtime message contracts. |
| `src/features/translation` | Google Translate web translation, language-code mapping, line-boundary validation, and translation degradation behavior. |
| `src/features/settings` | Overlay settings defaults and validation. |
| `src/shared` | Shared types, retry helpers, extension API wrappers, and test utilities. |

## Lyrics flow

1. `ContentApp` reads Spotify lyric rows, current track metadata, playback position, and the unsynced-lyrics notice.
2. `selectLyricsRequest` chooses one of three paths:
   - Spotify lyric rows when synced Spotify lyrics are available.
   - LRCLIB fallback when Spotify lyrics are missing or unsynced and the current track can be identified.
   - No request when neither source is usable.
3. Spotify-sourced lines are sent to the background through `lyra:translateLyrics`.
4. LRCLIB fallback requests are sent to the background through `lyra:fetchLyrics`.
5. The background cache controller returns a cached result or runs the requested LRCLIB and translation flow.
6. Lyra's replacement page renders original and translated lines, then highlights either Spotify's active line signal or the LRCLIB timestamp closest to playback.

## Replacement UI implementation

Lyra's current UI model is a replacement page, not inline modification of Spotify's original lyric rows.

- `entrypoints/content/index.tsx` creates a WXT shadow-root UI named `lyra-overlay`.
- The content script injects CSS that removes native hover treatment and makes native Spotify lyric text transparent when `data-lyra-native-lyrics-hidden="true"` is set.
- `ContentApp` reads Spotify's lyrics container and prepends a `data-lyra-replacement-host="true"` element.
- `ReplacementLyrics` is rendered into that host with a React portal.
- Spotify's native DOM remains present for text extraction and active-line sync, but the user-facing lyrics page is Lyra's own rendered UI.

## Runtime messages

| Message type | Direction | Purpose |
| --- | --- | --- |
| `lyra:fetchLyrics` | Content to background | Fetch LRCLIB lyrics for a track and translate them for the selected target language. |
| `lyra:fetchOriginalLyrics` | Content to background | Fetch LRCLIB original synced lyrics for a track without translation. |
| `lyra:translateLyrics` | Content to background | Translate visible Spotify lyric lines for the selected target language. |

Message schemas live in `src/features/lyrics/messages.ts`.

## Storage

Lyra uses `chrome.storage.local` through `getExtensionApi()`.

| Key | Owner | Contents |
| --- | --- | --- |
| `overlaySettings` | Content overlay | User settings for `targetLanguage` and `fontSize`. |
| `lyricsCache` | Background service worker | Cached lyrics results and expiry metadata. LRCLIB fallback keeps original lyrics separately from translated results, and Spotify translation entries use short hashed lyric-text keys. |

The lyrics cache keeps up to 200 entries. Bilingual and normal monolingual results are cached for 30 minutes, confirmed unavailable results for 5 minutes, transient unavailable results for 1 minute, and translation-degraded results for 2 minutes.

## External services

| Service | Used for | Configuration |
| --- | --- | --- |
| Spotify Web Player | Visible lyric DOM, track identity, playback position, and seek interactions. | Content script match: `https://open.spotify.com/*`. |
| LRCLIB | Synced fallback lyrics when Spotify lyrics are missing or unsynced. Lyra uses the public `https://lrclib.net/api` service through HTTP requests. | Host permission: `https://lrclib.net/*`; see `docs/lrclib-api.md`. |
| Google Translate web endpoint | Primary bilingual translation path. Lyra calls the web endpoint directly and validates lyric line boundaries before using the result. | Host permission: `https://translate.googleapis.com/*`; no environment variable is required. |

## Settings

The current settings surface supports:

- Target language: `en-US` or `zh-CN`.
- Font size: `sm`, `md`, or `lg`.

Unsupported or malformed persisted settings are sanitized back to defaults before use.

## Known boundaries

- Lyra does not open Spotify's lyrics panel automatically.
- Spotify-sourced lyrics do not expose LRCLIB-style timestamps, so Spotify's native active-line signal drives sync for that source.
- LRCLIB line clicks seek Spotify playback by timestamp; Spotify-sourced line clicks delegate to Spotify's native lyric row click behavior.
- Google Translate uses an unofficial web endpoint that can change or become rate limited.
- Translation is skipped when provider requests fail, source detection fails, a language pair is unsupported, or translated line counts do not match original line counts.
