# Lyra

Lyra is a Chromium browser extension for Spotify Web Player that shows synced bilingual lyrics inside the page.

Lyra first reads visible Spotify lyrics from the page and translates them through the configured LibreTranslate backend. If Spotify lyrics are not visible, Lyra falls back to LRCLIB only to retrieve synced original lyrics, then sends those lines through the same translation service.

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
src/features/overlay  Lyrics overlay UI and content app state
src/features/spotify  Spotify Web Player DOM readers and track helpers
src/features/lyrics   Lyric parsing, LRCLIB fallback, and lyrics messages
src/features/translation  LibreTranslate integration
src/features/settings Overlay settings defaults and validation
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
