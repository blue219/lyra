# LRCLIB Integration

This document describes how Lyra uses [LRCLIB](https://github.com/tranxuanthang/lrclib) for synced fallback lyrics.

LRCLIB is an open-source lyrics service for finding and contributing synchronized lyrics. Lyra uses the public `https://lrclib.net/api` service and does not import LRCLIB server code directly.

Official references:

- [LRCLIB website and API documentation](https://lrclib.net/docs)
- [LRCLIB GitHub repository](https://github.com/tranxuanthang/lrclib)

## Base URL

```text
https://lrclib.net/api
```

Lyra currently uses the public LRCLIB instance. If the project later supports a self-hosted LRCLIB base URL, add a Vite environment variable, update `wxt.config.ts` host permissions, and keep the fetch logic centralized in `src/features/lyrics/lrclib.ts`.

## Authentication

Lyra does not need an API key for LRCLIB read requests.

LRCLIB's API documentation says the API is openly accessible and encourages applications to send an identifying user-agent string. Lyra sends these headers on LRCLIB requests:

```http
Accept: application/json
X-User-Agent: Lyra 0.1.0
Lrclib-Client: Lyra 0.1.0
```

## Search Lyrics

Lyra uses LRCLIB search because Spotify Web Player metadata can be incomplete or slightly different from LRCLIB records.

```http
GET /api/search
```

Supported query fields used by Lyra:

| Field | Required by Lyra | Description |
| --- | --- | --- |
| `track_name` | Yes | Current Spotify track title. |
| `artist_name` | First attempt only | Current Spotify artists joined with `, `. |

Lyra search strategy:

1. Search with `track_name` and `artist_name`.
2. If no synced match is found, search again with only `track_name`.
3. Ignore instrumental records and records without `syncedLyrics`.
4. Score remaining records by synced lyrics availability, exact or partial title match, artist match, and album match when Spotify album metadata is available.

Example request:

```http
GET /api/search?track_name=I+Want+to+Live&artist_name=Borislav+Slavov
```

Example response shape:

```json
[
  {
    "id": 3396226,
    "trackName": "I Want to Live",
    "artistName": "Borislav Slavov",
    "albumName": "Baldur's Gate 3 (Original Game Soundtrack)",
    "duration": 233,
    "instrumental": false,
    "plainLyrics": "I feel your breath upon my neck\n...",
    "syncedLyrics": "[00:17.12] I feel your breath upon my neck\n..."
  }
]
```

## Exact Match Endpoint

LRCLIB also documents an exact-match endpoint:

```http
GET /api/get
```

That endpoint expects a full track signature, including `track_name`, `artist_name`, `album_name`, and `duration` in seconds. LRCLIB uses duration matching when selecting records.

Lyra does not currently use `/api/get` because Spotify page metadata is not always complete enough for exact matching. The current search-based flow is more forgiving for browser-extension fallback behavior.

## Response Fields Lyra Uses

| Field | Use |
| --- | --- |
| `trackName` | Match scoring and diagnostics. |
| `artistName` | Match scoring. |
| `albumName` | Match scoring when Spotify album metadata is available. |
| `duration` | Kept as record metadata; not currently used in scoring. |
| `instrumental` | Instrumental records are ignored for lyric display. |
| `syncedLyrics` | Parsed into timestamped lyric lines. Required for LRCLIB fallback. |

`plainLyrics` is not used for fallback rendering because Lyra needs synced timestamps for playback highlighting and seeking.

## Error Handling

LRCLIB requests use the shared retry helper:

- Retry network errors.
- Retry HTTP `429`.
- Retry HTTP `5xx`.
- Use two retry delays: `200ms` and `400ms`.
- Treat non-retryable `4xx` responses and invalid payloads as unavailable lyrics.

When LRCLIB fallback is unavailable, Lyra keeps the overlay readable and shows the normal unavailable state instead of throwing an extension-level error.

## Lyra Integration

Implementation file: `src/features/lyrics/lrclib.ts`.

The content overlay requests LRCLIB fallback through the background service worker with `lyra:fetchLyrics`. The background cache controller stores LRCLIB results in `chrome.storage.local` under `lyricsCache`, using the normalized track identity and target language as part of the cache key.
