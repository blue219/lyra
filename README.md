# Lyra

Lyra is a Chromium browser extension for Spotify Web Player that shows synced bilingual lyrics inside the page.

Current translation display is based on LRCLIB lyric lines that already embed a second language. Lyra uses lightweight text heuristics to identify common embedded English, Chinese, Japanese, and Spanish translations for the in-overlay language filter.

## Stack

- WXT
- React 19
- TypeScript 6
- Tailwind CSS 4
- Manifest V3

## Local development

1. Install dependencies:

```bash
npm install
```

2. Start the extension dev server on port `5173`:

```bash
npm run dev
```

3. Load the generated Chromium extension from the `.output/chrome-mv3` directory.

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
