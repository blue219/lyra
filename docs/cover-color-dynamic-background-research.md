# Cover-color dynamic background research

## Decision

Lyra derives its lyrics-background palette from the visible Spotify Now Playing
cover without using Spotify OAuth. The content script reads the displayed cover
URL, while the MV3 Service Worker fetches and samples only approved cover images.
The fixed Aurora palette remains the failure fallback.

## Constraints

- Extension Service Worker requests require an explicit matching host permission;
  content-script requests remain subject to the page's cross-origin rules.
  [Chrome extension network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- A cross-origin image that was not successfully fetched with CORS cannot safely
  expose canvas pixels. The Canvas `origin-clean` rules make direct sampling of
  Spotify's page-owned `img` unreliable.
  [HTML Canvas origin-clean](https://html.spec.whatwg.org/multipage/canvas.html)
- Spotify's Playback State API can expose album images, but requires OAuth and
  `user-read-playback-state`; this is unnecessary when the Web Player already
  displays the cover.
  [Spotify Playback State API](https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback)

## Implementation boundary

- The only allowed cover host is `https://i.scdn.co/*`; the background validates
  HTTPS and the exact hostname before downloading without credentials.
- Images are sampled at 32 by 32 pixels. Transparent, grayscale, near-black, and
  near-white pixels are ignored; a dominant hue yields a readable three-step
  palette. Low-color or failed images use the fixed palette.
- Derived palettes are held in Service Worker memory by cover URL. They are not
  stored in lyrics cache or browser storage.
- The cover palette always affects the static background. The Dynamic Background
  setting and reduced-motion preference control Aurora motion only.
