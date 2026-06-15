# Lyra

Lyra is a Chromium browser extension for Spotify Web Player that shows bilingual lyrics on Spotify's lyrics page.

Lyra does not inject translated text into Spotify's native lyric rows. Instead, it visually disables Spotify's native lyrics UI, keeps the native DOM available only as a data and sync source, and renders its own React lyrics page in the same lyrics area. When Spotify lyrics are not available, Lyra falls back to synced LRCLIB lyrics for the current track.

Lyra uses a self-hosted [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) service for translation and [LRCLIB](https://github.com/tranxuanthang/lrclib) for synced fallback lyrics. The current development translation backend supports English and Simplified Chinese.

## Stack

- WXT
- React 19
- TypeScript 6
- Tailwind CSS 4
- Manifest V3
- Vitest

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

Prerequisites:

- Node.js 22 LTS
- npm
- Chrome or another Chromium browser

1. Install dependencies:

```bash
npm install
```

2. Create a local `.env` file from `.env.example` and set your LibreTranslate configuration:

```bash
VITE_LIBRETRANSLATE_BASE_URL=http://154.44.10.127:5000
VITE_LIBRETRANSLATE_API_KEY=<your-api-key>
```

3. Start the extension dev server on port `5173`:

```bash
npm run dev
```

4. Open your existing Chrome window and visit `chrome://extensions`.

5. Enable developer mode.

6. Load the generated Chromium extension from the `.output/chrome-mv3` directory.

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_LIBRETRANSLATE_BASE_URL` | No | `http://154.44.10.127:5000` | LibreTranslate-compatible backend used for language detection and translation. |
| `VITE_LIBRETRANSLATE_API_KEY` | Yes for translation | None | API key sent as `api_key` in LibreTranslate JSON request bodies. |

Without `VITE_LIBRETRANSLATE_API_KEY`, Lyra still renders original lyrics but skips translation.

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

## Documentation

- [Development notes](docs/development.md): local loading, manual smoke checks, caching, and integration behavior.
- [Architecture](docs/architecture.md): extension data flow, storage keys, runtime messages, and boundaries.
- [LibreTranslate API](docs/libretranslate-api.md): self-hosted translation backend setup, requests, and Lyra integration details.
- [LRCLIB API](docs/lrclib-api.md): synced fallback lyrics API usage and Lyra integration details.
