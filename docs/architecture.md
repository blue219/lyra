# Lyra Architecture

This document is authoritative for Lyra's internal structure and runtime data
flow. Lyra is a single-package Chromium Manifest V3 extension built with WXT.

## Layers and dependency direction

Production code under `src/` follows one dependency direction:

```text
domain <- ports <- application <- adapters <- ui
                                      ^          ^
                                      |          |
                                  entrypoints compose dependencies
```

- `domain` contains Track, Lyrics, Translation, Cache, settings, and pure rules.
- `ports` defines the Spotify, LRCLIB, translation, storage, runtime messaging,
  and clock seams. Production adapters and test adapters implement these ports.
- `application` owns lyrics selection, translation orchestration, V2 cache policy,
  and the overlay controller. These are deep modules: callers do not coordinate
  retries, cancellation, degradation, deduplication, or state publication.
- `adapters` contains Spotify DOM readers, HTTP providers, and Chromium
  storage/runtime implementations.
- `ui` renders controller state for the overlay and popup. UI code does not fetch
  lyrics, inspect Spotify DOM, or parse runtime messages directly.
- `entrypoints` is the composition root for background, content gate, ESM content
  UI, and popup runtimes.

There are no compatibility re-exports for the former `src/features` or
`src/shared` paths.

## Lyrics result

`LyricsResult` is a strict discriminated union.

- `status: "available"` always includes original lyric lines, a `source`
  (`spotify` or `lrclib`), and optional translation. If translation degrades, the
  original remains available and `degradationReason` explains why.
- `status: "unavailable"` includes a reason such as `not-found`, `instrumental`,
  `network-error`, `rate-limited`, `provider-error`, `invalid-response`, or
  `timeout`.
- Cancellation is control flow, not a lyrics result. Cancelled work is neither
  published as unavailable nor written to cache.

## Runtime protocol

`RuntimeRequestMap` is the single source of truth for runtime messages. A typed
client sends requests and a handler registry validates the complete nested
payload before dispatch. Unknown keys, malformed arrays, invalid line entries,
and invalid response values are rejected.

Supported requests are:

| Type                         | Purpose                                                               |
| ---------------------------- | --------------------------------------------------------------------- |
| `lyra:fetchLyrics`           | Resolve LRCLIB fallback and optional translation for one track.       |
| `lyra:translateLyrics`       | Translate Spotify-provided lines.                                     |
| `lyra:getLyricsCacheSummary` | Read V2 song and entry counts.                                        |
| `lyra:clearLyricsCache`      | Cancel active work, increment cache generation, and clear V2 entries. |

The removed combined/original-only request and direct content-script HTTP
fallback are not supported.

## Overlay controller

The overlay controller owns one semantic state stream. It uses a narrowed,
throttled MutationObserver that watches Spotify's main content and player areas.
Spotify's native active-line DOM mutation drives Spotify-sourced highlighting.
Only LRCLIB-sourced synced lyrics read playback position, approximately every
250 ms. Playback polling pauses while the document is hidden. The controller
publishes only when the semantic state changes.

Track changes and controller disposal abort current work. A complete lyrics flow
has a 25-second deadline; every individual HTTP attempt has an 8-second deadline.

## ESM content UI loading

The manifest content script is a lightweight gate. It watches Spotify SPA
navigation and a small lyrics DOM surface. On the first `/lyrics` route or when a
lyrics container appears, it loads `/content-scripts/esm/content.js` through an
extension URL with Vite-ignore semantics.

The ESM bundle is produced by a dedicated Vite build based on WXT's official ESM
content-script example. WXT's development watcher rebuilds it and reloads the
gate content script. The manifest exposes only `/content-scripts/esm/*` and only
to `https://open.spotify.com/*` through `web_accessible_resources`.

The ESM UI fetches its generated CSS by extension URL and injects it into the
ShadowRoot. OGL remains a dynamic import and is loaded only when the dynamic
background setting is enabled. Normal application `import()` is not used as a
content-script splitting mechanism.

## External adapters

- Spotify DOM: stable `data-testid` selectors are preferred. English text is an
  explicit fallback. Other Spotify UI languages are unsupported.
- LRCLIB: only synchronized, non-instrumental candidates with an exactly
  normalized title and at least one normalized artist match are accepted. If both
  sides include duration, the difference must be no more than five seconds.
  Track-only search uses the same acceptance rules.
- Translation: provider requests use `credentials: "omit"`. Providers that cannot
  work without cookies are removed with their host permission.

## Storage

User settings remain compatible under `overlaySettings`. Persisted values are
validated and unknown values fall back to defaults. A failed setting save is
shown inline and the UI rolls back by re-reading persisted settings.

Lyrics use `lyricsCacheV2`; the former `lyricsCache` value is removed during V2
hydration. Each structured entry explicitly stores `songKey`, source, target
language, result, expiry, and last-access time. Callers never parse a string key
to derive metadata. Cache clear increments an in-memory generation and aborts
active requests, so work started in an older generation cannot repopulate cache.
The limit is 200 entries with LRU eviction. The UI reports unique song count and
`entries/200` separately.

Available results use a 30-minute TTL, confirmed unavailable results use five
minutes, transient failures use one minute, and translation-degraded originals
use two minutes. Timeout results are transient. Cancellation is not cached.

## Action and permissions

The browser action is disabled by default and enabled only on
`https://open.spotify.com/*` by the background adapter. The manifest requires
`storage` and `declarativeContent`, Spotify content matches, and the minimum host
permissions for accepted HTTP providers. Contract tests lock these values and the
restricted WAR scope.
