# Lyra Development Notes

## MVP behavior

Lyra injects a lyrics overlay into `https://open.spotify.com/*`, detects the current track from the page, fetches synced lyrics from LRCLIB, and highlights the active line during playback. If a translation is unavailable for the selected target language, the overlay keeps showing the original lyrics and clearly indicates the degraded state.

## Manual loading

1. Run `npm install`.
2. Run `npm run dev`.
3. Open Chromium and visit the extensions page.
4. Enable developer mode.
5. Load the unpacked extension from `.output/chrome-mv3`.
6. Open Spotify Web Player and verify the Lyra overlay appears after the page finishes loading.

## Manual smoke checklist

- Overlay renders only on Spotify Web Player.
- Track changes trigger a new LRCLIB request.
- Active line highlighting advances while playback time changes.
- Monolingual and unavailable lyric states remain readable.
- The target language filter can show embedded English translations when available.
- Font size, language, and overlay position settings persist across refresh.
