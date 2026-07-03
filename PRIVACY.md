# Privacy Policy for Lyra

Last updated: July 3, 2026

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
- User settings, such as target language, font size, dynamic background
  preference, and lyrics cache controls.
- Cached lyrics results and cache metadata stored locally in the browser.

## Data Sent to Third-Party Services

Lyra may send limited data to third-party services only when required for its
core functionality:

- LRCLIB: current track metadata may be sent to LRCLIB to find synced fallback
  lyrics when Spotify lyrics are missing or unsynced.
- Translation providers: lyric text may be sent to Google Translate, Microsoft
  Translator, or Bing Translator web endpoints to generate translations in the
  selected target language.

Lyra does not send Spotify account credentials, browser cookies, passwords, or
payment information to these services.

## Local Storage

Lyra uses browser local storage through `chrome.storage.local` to store:

- Overlay settings.
- Lyrics cache entries.
- Cache summary data needed to show cached song count and estimated cache size.

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
- `https://translator.bing.com/*` and `https://www.bing.com/*`: provide fallback
  translation options when the primary translation request is unavailable or
  unusable.

## Contact

For questions or privacy requests, open an issue at:

https://github.com/blue219/lyra/issues
