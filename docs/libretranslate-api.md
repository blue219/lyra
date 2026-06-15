# LibreTranslate Integration

This document describes how Lyra uses a self-hosted [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) backend for lyric language detection and translation.

LibreTranslate is a free and open-source machine translation API. It can be self-hosted and does not depend on proprietary translation providers. Lyra treats it as an HTTP service and does not import LibreTranslate code directly.

Official references:

- [LibreTranslate GitHub repository](https://github.com/LibreTranslate/LibreTranslate)
- [LibreTranslate API documentation](https://docs.libretranslate.com/api/operations/translate/)
- [Self-hosted API key management](https://docs.libretranslate.com/guides/manage_api_keys/)

## Base URL

```text
http://154.44.10.127:5000
```

## Authentication

The server requires an API key.

Send the key as `api_key` in the JSON request body.

Do not commit real API keys into the repository. Use local environment variables:

```text
VITE_LIBRETRANSLATE_BASE_URL=http://154.44.10.127:5000
VITE_LIBRETRANSLATE_API_KEY=<your-api-key>
```

For a self-hosted LibreTranslate instance, start LibreTranslate with API key support enabled and create a key with `ltmanage keys`. Keep the generated key outside the repository and put it only in local or deployment environment variables.

## Supported Languages

The server is currently configured to load only English and Simplified Chinese models.

| Language | Code |
| --- | --- |
| English | `en` |
| Simplified Chinese | `zh-Hans` |

Lyra maps browser UI language values to LibreTranslate language codes:

| Lyra setting | LibreTranslate code |
| --- | --- |
| `en-US` | `en` |
| `zh-CN` | `zh-Hans` |

Use `zh-Hans`, not `zh`, when translating to Simplified Chinese.

## Detect Source Language

Lyra detects the source language before translating. Detection runs once for the whole lyrics result, not once per lyric line.

```http
POST /detect
Content-Type: application/json
```

Request body:

```json
{
  "q": "Hello, world!\nThis is a lyric line.",
  "api_key": "<your-api-key>"
}
```

Expected response shape:

```json
[
  {
    "confidence": 100,
    "language": "en"
  }
]
```

If detection fails, returns an unsupported language, or returns the same language as the selected target language, Lyra keeps showing original lyrics.

## Translate Text

```http
POST /translate
Content-Type: application/json
```

Request body:

```json
{
  "q": "Hello, world!",
  "source": "en",
  "target": "zh-Hans",
  "format": "text",
  "api_key": "<your-api-key>"
}
```

Response:

```json
{
  "translatedText": "哈罗,世界!"
}
```

## JavaScript Example

This mirrors the request shape Lyra uses internally.

```ts
const response = await fetch("http://154.44.10.127:5000/translate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    q: "Hello, world!",
    source: "en",
    target: "zh-Hans",
    format: "text",
    api_key: import.meta.env.VITE_LIBRETRANSLATE_API_KEY,
  }),
});

if (!response.ok) {
  throw new Error(`LibreTranslate request failed: ${response.status}`);
}

const data = await response.json();
console.log(data.translatedText);
```

## Lyra Integration

Lyra detects source language first by sending all lyric lines as a newline-separated `q` value to `POST /detect` with `api_key` in the JSON body.

Lyra then batches lyric lines into a single `q` value separated by newlines for `POST /translate`, and splits `translatedText` back into line-level translations. If detection fails, returns an unsupported language, matches the selected target language, or if the translated split line count does not match the original line count, Lyra shows original lyrics.

Implementation file: `src/features/translation/translate.ts`.

## Check Available Languages

```http
GET /languages
```

Example:

```bash
curl http://154.44.10.127:5000/languages
```

Expected response:

```json
[
  {
    "code": "en",
    "name": "English",
    "targets": ["en", "zh-Hans"]
  },
  {
    "code": "zh-Hans",
    "name": "Chinese",
    "targets": ["en", "zh-Hans"]
  }
]
```

## Notes

- The service is currently exposed over plain HTTP for development.
- For production usage, put it behind HTTPS and avoid exposing the raw translation service directly to browsers.
- If `VITE_LIBRETRANSLATE_BASE_URL` changes, update `host_permissions` in `wxt.config.ts` so the browser extension can call the new host.
