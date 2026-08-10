# Privacy Policy for Lyra

Last updated: August 10, 2026

Lyra is a browser extension for Spotify Web Player that displays bilingual synced
lyrics. This policy explains what data Lyra processes and how that data is used.

## Single Purpose

Lyra's single purpose is to display original and translated lyrics on Spotify Web
Player. To do this, Lyra reads the current Spotify page, fetches fallback synced
lyrics when needed, translates lyric text into the selected target language, and
highlights the active lyric line during playback.

## Data Lyra Processes

Lyra may process the following data only to provide its lyrics features:

- Current Spotify track metadata, such as title, artist, album, and duration.
- Visible Spotify lyric text and active lyric line state.
- Playback position used for lyric highlighting and LRCLIB timestamp seeking.
- The current Now Playing cover image URL and a short-lived, derived color palette.
- User settings, such as target language, font size, dynamic background
  preference, and lyrics cache controls.
- Cached lyrics results and cache metadata stored locally in the browser.

## Data Sent to Third-Party Services

Lyra may send limited data to third-party services only when required for its
core functionality:

- LRCLIB: current track metadata may be sent to LRCLIB to find synced fallback
  lyrics when Spotify lyrics are missing or unsynced.
- Translation provider: lyric text may be sent to Google Translate to generate
  translations in the selected target language.
- Spotify image CDN: when a supported Now Playing cover is visible, Lyra fetches
  the cover image from `i.scdn.co` without credentials solely to derive a
  background palette. The image and palette are held only in memory for the
  current extension Service Worker lifetime.

Lyra does not send Spotify account credentials, browser cookies, passwords, or
payment information to these services.

## Local Storage

Lyra uses browser local storage through `chrome.storage.local` to store:

- Overlay settings.
- Lyrics cache entries and their cache metadata.

Cache summaries, including song and entry counts and estimated serialized size,
are calculated on demand from those entries and are not stored separately.

Users can clear Lyra's lyrics cache from the extension settings.

## Data Lyra Does Not Collect

Lyra does not:

- Sell user data.
- Use user data for advertising.
- Include analytics or tracking scripts.
- Collect personally identifying information for the developer.
- Share user data with data brokers.
- Remotely load or execute hosted JavaScript code.

## Permissions

Lyra requests only the permissions needed for its lyrics features:

- `storage`: saves settings and local lyrics cache data.
- `declarativeContent`: enables the extension action only on Spotify Web Player
  pages.
- `https://open.spotify.com/*`: runs Lyra on Spotify Web Player to read visible
  lyrics and render the replacement lyrics UI.
- `https://lrclib.net/*`: fetches fallback synced lyrics.
- `https://translate.googleapis.com/*`: translates lyric text.
- `https://i.scdn.co/*`: retrieves the visible Spotify cover image without
  credentials to derive the lyrics background palette.

## Contact

For questions or privacy requests, open an issue at:

https://github.com/blue219/lyra/issues
