# Lyra Development Notes

## MVP behavior

Lyra injects a lyrics overlay into `https://open.spotify.com/*`, detects the current track from the page, reads visible Spotify lyrics when available, and sends those lines to the configured LibreTranslate backend. If Spotify lyrics are not visible, Lyra falls back to LRCLIB only to fetch synced original lyrics, then translates those fallback lines through the same backend.

The current translation service supports English and Simplified Chinese. If translation is unavailable, missing an API key, or fails, the overlay keeps showing original lyrics.

## Manual loading

1. Run `npm install`.
2. Copy `.env.example` to `.env` and set `VITE_LIBRETRANSLATE_API_KEY`.
3. Run `npm run dev`.
4. Open your existing Chrome window and visit `chrome://extensions`.
5. Enable developer mode.
6. Load the unpacked extension from `.output/chrome-mv3`.
7. Open Spotify Web Player and verify the Lyra overlay appears after the page finishes loading.

`npm run dev` uses WXT's manual runner so development happens inside your own Chrome session.

## Manual smoke checklist

- Overlay renders only on Spotify Web Player.
- Visible Spotify lyrics are translated through LibreTranslate.
- Spotify's active lyric line is reflected in the overlay when the active DOM line can be detected.
- When Spotify lyrics are not visible, Lyra fetches original synced lyrics from LRCLIB as a fallback.
- Monolingual, translated, and unavailable lyric states remain readable.
- English and Simplified Chinese target language settings persist across refresh.
- Font size and overlay position settings persist across refresh.

## Spotify lyrics behavior

Lyra does not click Spotify controls or open the lyrics panel automatically. It only reads lyric lines already present in the page DOM. If no visible lyric lines can be read, the fallback LRCLIB flow is used.

Spotify lyric lines do not expose LRCLIB-style timestamps in the extension. For Spotify-sourced lyrics, Lyra highlights the line Spotify marks as active. If no active DOM marker can be detected, Lyra displays translated lines without an active highlight.

## LRCLIB fallback behavior

LRCLIB is now a fallback source for original synced lyrics only. Lyra does not use LRCLIB embedded bilingual text as translation data and does not prefer LRCLIB results based on a requested translation language.

Fallback lookup uses LRCLIB search with track and artist first, then track-only search if no artist-constrained match is found. The selected synced lyrics are parsed as original text and translated through LibreTranslate.

## LibreTranslate behavior

Lyra sends batched lyric lines to the configured LibreTranslate backend with a stable internal separator so returned lines can be mapped back to lyric rows.

- Base URL defaults to `http://154.44.10.127:5000`.
- `VITE_LIBRETRANSLATE_BASE_URL` can override the base URL.
- `VITE_LIBRETRANSLATE_API_KEY` is required for translation requests.
- The request body includes `q`, `source`, `target`, `format`, and `api_key`.
- On network errors, non-2xx responses, response format errors, or line-count mismatches, Lyra keeps showing original lyrics.
