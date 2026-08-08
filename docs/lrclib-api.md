# LRCLIB Integration

Lyra uses the public [LRCLIB API](https://lrclib.net/docs) for synchronized
fallback lyrics. It does not require an API key and does not import LRCLIB server
code.

## Requests

The adapter calls `GET https://lrclib.net/api/search` first with `track_name` and
`artist_name`, then with `track_name` only if no acceptable candidate exists.
Every request sends `Accept: application/json`, `X-User-Agent`, and
`Lrclib-Client`. The client identifier is generated from the single package
version source at build time; documentation does not duplicate a release number.

Each attempt has an eight-second timeout and receives the complete-flow
AbortSignal. Network failures, HTTP 429, and HTTP 5xx can retry with 200 ms and
400 ms backoff while the signal remains active. Other 4xx responses and invalid
payloads fail without retry.

## Candidate acceptance

Accuracy is preferred over availability. A candidate is accepted only when all
conditions hold:

1. `syncedLyrics` is present and parseable.
2. `instrumental` is false.
3. The normalized candidate title exactly equals the normalized Spotify title.
4. At least one normalized candidate artist equals a Spotify artist.
5. If both records have a duration, the absolute difference is at most five
   seconds.

Normalization is case-insensitive, Unicode-aware, whitespace-collapsing, and
removes common version decorations consistently. Live, remix, acoustic, and
remaster labels are not treated as interchangeable unless both normalized titles
remain exactly equal. The title-only request applies the same artist and duration
acceptance rules; it broadens discovery, not validation.

`plainLyrics` is not used because fallback rendering and seeking require synced
timestamps.

## Result mapping

- No acceptable candidate maps to `not-found`.
- An otherwise matching instrumental record maps to `instrumental`.
- HTTP timeout maps to `timeout`.
- Exhausted 429 maps to `rate-limited`.
- Network failures map to `network-error`.
- Invalid payloads map to `invalid-response`.
- Abort from track change, unload, or cache clear is propagated as cancellation
  and never becomes a result or cache entry.

See [Architecture](architecture.md) for caching and runtime protocol details.
