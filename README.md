# Lyra

<p align="center">
  <img src="src/assets/branding/toolbar/lyra-toolbar-green-transparent.png" alt="Lyra logo" width="160">
</p>

<p align="center">
  <strong>Bilingual lyrics for Spotify Web Player.</strong>
</p>

<p align="center">
  Lyra replaces Spotify's lyrics view with a clean React-powered bilingual lyrics page,
  backed by Spotify's native lyric sync, LRCLIB fallback lyrics, and a web translation provider chain.
</p>

<p align="center">
  <img alt="Node.js 22" src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111111">
  <img alt="TypeScript 6" src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white">
  <img alt="WXT" src="https://img.shields.io/badge/WXT-0.20-6B5CFF">
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white">
</p>

## Overview

Lyra is a Chromium browser extension for Spotify Web Player. It helps listeners read and understand lyrics in two languages while the song is playing.

Instead of injecting translated text into Spotify's native lyric rows, Lyra visually disables the native lyrics UI, keeps Spotify's DOM available as a data and sync source, and renders its own lyrics page in the same area. When Spotify lyrics are unavailable or unsynced, Lyra can fall back to synced lyrics from [LRCLIB](https://github.com/tranxuanthang/lrclib).

Translation uses Google Translate's web endpoint first, then falls back to Microsoft Translator and Bing Translator web endpoints for failed lyric chunks. When no provider can preserve lyric line boundaries, Lyra keeps showing the original lyrics.

## Features

- Detects the currently playing Spotify track.
- Reads Spotify's visible synced lyric rows when available.
- Falls back to synced LRCLIB lyrics when Spotify lyrics are missing or unsynced.
- Displays original and translated lyrics together.
- Highlights the active lyric line during playback.
- Supports line clicks for active-line selection and LRCLIB timestamp seeking.
- Persists basic overlay settings such as target language and font size.
- Keeps translation failure graceful by showing original lyrics when translation is unavailable.

## Tech Stack

| Area | Technology |
| --- | --- |
| Extension framework | WXT, Manifest V3 |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript 6 |
| Build tooling | Vite 8 |
| Testing | Vitest, jsdom |
| Lyrics source | Spotify Web Player DOM, LRCLIB |
| Translation | Google, Microsoft Translator, and Bing Translator web endpoints |

## Project Structure

```text
entrypoints/                 WXT extension entrypoints
src/features/overlay         Lyrics replacement UI and content app state
src/features/spotify         Spotify Web Player DOM readers and track helpers
src/features/lyrics          LRCLIB fallback, synced lyric parsing, cache, messages
src/features/translation     Translation provider orchestration
src/features/settings        Overlay settings defaults and validation
src/shared                   Shared types, retry helpers, and extension utilities
docs/                        Architecture, development, and API notes
```

## Getting Started

### Prerequisites

- Node.js 22 LTS
- npm
- Chrome or another Chromium-based browser

### Installation

Install dependencies:

```bash
npm install
```

Start WXT development mode on port `5173`:

```bash
npm run dev
```

Load the unpacked extension:

1. Open `chrome://extensions`.
2. Enable developer mode.
3. Click **Load unpacked**.
4. Select `.output/chrome-mv3`.
5. Open Spotify Web Player and navigate to the lyrics view.

## Configuration

Lyra does not require local environment variables for translation. The generated extension manifest grants access to LRCLIB, Google Translate, Microsoft Translator, and Bing Translator through static host permissions.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start WXT development mode on port `5173`. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run compile` | Run TypeScript without emitting files. |
| `npm run build` | Build the production extension bundle. |
| `npm run zip` | Create a distributable extension zip through WXT. |

## Validation

Run the smallest relevant checks while developing:

```bash
npm test
npm run compile
npm run build
```

For browser-level validation, load `.output/chrome-mv3`, open Spotify Web Player, enter the lyrics view, and confirm that Lyra renders the replacement lyrics page with readable original and translated lines.

## Documentation

- [Development notes](docs/development.md): local loading, manual smoke checks, caching, and integration behavior.
- [Architecture](docs/architecture.md): extension data flow, storage keys, runtime messages, and boundaries.
- [LRCLIB API](docs/lrclib-api.md): synced fallback lyrics API usage and Lyra integration details.

## Known Boundaries

- Lyra does not open Spotify's lyrics panel automatically.
- Spotify-sourced lyrics use Spotify's native active-line signal rather than LRCLIB timestamps.
- Translation uses unofficial web endpoints that can change, fail, or become rate limited.
- Translation is skipped when provider requests fail, language detection fails, the language pair is unsupported, or translated line counts do not match original lines.

## Contributing

Contributions should keep Lyra simple, reliable, and focused on Spotify bilingual lyrics.

Before opening a change:

1. Read the relevant document in `docs/`.
2. Keep changes scoped to the affected feature area.
3. Prefer existing project utilities and patterns.
4. Run the smallest relevant validation command first.
5. Update documentation when setup, usage, behavior, APIs, or environment variables change.

## License

Lyra is licensed under the [MIT License](LICENSE).
