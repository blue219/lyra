# Lyra

Lyra is a Chromium browser extension for Spotify Web Player that shows bilingual lyrics on Spotify's lyrics page.

Lyra renders its own lyrics view inside Spotify's lyrics page. It keeps Spotify's native lyrics DOM available as the preferred source for visible lyrics and playback sync, visually hides the native text, and displays Lyra-rendered original and translated lines in the same page area. When Spotify lyrics are not available, Lyra falls back to synced LRCLIB lyrics for the current track.

The current development translation backend supports English and Simplified Chinese.

## Stack

- WXT
- React 19
- TypeScript 6
- Tailwind CSS 4
- Manifest V3

## Project structure

```text
entrypoints/          WXT extension entrypoints
src/features/overlay  Lyrics page replacement rendering and content app state
src/features/spotify  Spotify Web Player DOM readers and track helpers
src/features/lyrics   Lyric parsing, LRCLIB fallback, and lyrics messages
src/features/translation  LibreTranslate integration
src/features/settings Inline lyric settings defaults and validation
src/shared            Cross-feature types and browser extension helpers
docs/                 Development and API notes
```

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create a local `.env` file from `.env.example` and set your LibreTranslate key:

```bash
VITE_LIBRETRANSLATE_API_KEY=<your-api-key>
```

3. Start the extension dev server on port `5173`:

```bash
npm run dev
```

4. Open your existing Chrome window and visit `chrome://extensions`.

5. Enable developer mode.

6. Load the generated Chromium extension from the `.output/chrome-mv3` directory.

## Validation

- Run unit tests:

```bash
npm test
```

- Run a type-only compile check:

```bash
npm run compile
```

- Build the production bundle:

```bash
npm run build
```

See [docs/development.md](/D:/code/Web/lyra/docs/development.md) for MVP behavior and manual validation steps.
