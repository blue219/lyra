# LibreTranslate API

This document describes the LibreTranslate backend currently deployed for Lyra development.

## Base URL

```text
http://154.44.10.127:5000
```

## Authentication

The server requires an API key.

Send the key as `api_key` in the JSON request body.

Do not commit real API keys into the repository. Use a local environment variable such as:

```text
VITE_LIBRETRANSLATE_API_KEY=<your-api-key>
```

## Supported Languages

The server is currently configured to load only English and Simplified Chinese models.

| Language | Code |
| --- | --- |
| English | `en` |
| Simplified Chinese | `zh-Hans` |

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

Lyra batches lyric lines into a single `q` value using an internal separator, then splits `translatedText` back into line-level translations. If the split line count does not match the original line count, Lyra discards the translation response and shows original lyrics.

The browser extension currently maps UI language values as follows:

| Lyra setting | LibreTranslate code |
| --- | --- |
| `en-US` | `en` |
| `zh-CN` | `zh-Hans` |

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

- Use `zh-Hans`, not `zh`, when translating to Simplified Chinese.
- The service is currently exposed over plain HTTP for development.
- For production usage, put it behind HTTPS and avoid exposing the raw translation service directly to browsers.
