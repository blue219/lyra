# Lyra Development Notes

## MVP behavior

Lyra injects a lyrics overlay into `https://open.spotify.com/*`, detects the current track from the page, fetches synced lyrics from LRCLIB, and highlights the active line during playback. If a translation is unavailable for the selected target language, the overlay keeps showing the original lyrics and clearly indicates the degraded state.

## Manual loading

1. Run `npm install`.
2. Run `npm run dev`.
3. Open your existing Chrome window and visit `chrome://extensions`.
4. Enable developer mode.
5. Load the unpacked extension from `.output/chrome-mv3`.
6. Open Spotify Web Player and verify the Lyra overlay appears after the page finishes loading.

`npm run dev` no longer launches a separate Chrome window automatically. Lyra now uses WXT's manual runner so development happens inside your own Chrome session.

## Manual smoke checklist

- Overlay renders only on Spotify Web Player.
- Track changes trigger a new LRCLIB request.
- Active line highlighting advances while playback time changes.
- Monolingual and unavailable lyric states remain readable.
- The target language filter can show embedded English translations when available.
- Font size, language, and overlay position settings persist across refresh.

## LRCLIB lookup behavior

Use LRCLIB's signature lookup only when Spotify exposes the full track signature: title, artist, album, and duration in seconds. If album or duration is unavailable, fall back to LRCLIB search instead of sending an incomplete `/api/get` request. LRCLIB does not expose a dedicated translation or target-language parameter.

Embedded bilingual lines are parsed by detecting the language on each side of a supported separator. When the selected target language appears on the left side of a pair, Lyra treats that side as the translated line and keeps the other side as the primary lyric.

## Machine translation fallback

When the best LRCLIB match is monolingual and the selected target language differs from the detected source language, Lyra automatically requests a free machine translation via `translate.googleapis.com`.

- Lines are batched into a single request for efficiency.
- Batched lines use a stable internal separator because Google Translate can collapse ordinary newline separators.
- If the translated line count matches the original, each line receives a `translated` field and the result is promoted to `bilingual`.
- On any failure (network error, mismatched line count, rate limiting) the overlay continues to show the original lyrics without translation.
