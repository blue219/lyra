# Lyra

Lyra is a Chromium Manifest V3 extension that displays original and translated
lyrics in Spotify Web Player. It prefers Spotify's synced lyrics and uses
[LRCLIB](https://lrclib.net) as an accuracy-checked fallback.

## Use Lyra

Requirements: Node.js 22, npm 10.9.4, and a Chromium browser.

```bash
npm install
npm run dev
```

Open `chrome://extensions`, enable developer mode, choose **Load unpacked**, and
select `.output/chrome-mv3-dev`. Then open `https://open.spotify.com`, navigate to
the lyrics view, and use the Lyra toolbar popup to choose a translation language,
font size, and dynamic background preference.

Production packages are created with:

```bash
npm run build
npm run zip
```

## Documentation

- [Architecture](docs/architecture.md) is authoritative for layers, runtime
  messages, settings, caching, and content loading.
- [Development](docs/development.md) contains setup, validation, E2E, and manual
  smoke instructions.
- [LRCLIB integration](docs/lrclib-api.md) documents candidate acceptance and
  HTTP behavior.
- [Privacy](PRIVACY.md) describes data handling.
- [Visual reference](DESIGN.md) is non-normative design guidance.

Lyra supports the English Spotify UI on Chromium MV3. It does not open Spotify's
lyrics view automatically and does not provide a lyric-position setting.

## License

[MIT](LICENSE)
