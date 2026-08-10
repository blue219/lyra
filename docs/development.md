# Lyra Development

## Requirements and setup

- Node.js `>=22 <23`
- npm `10.9.4`
- A Chromium browser

```bash
npm install
npm run dev
```

WXT listens on port `5173`. Load `.output/chrome-mv3-dev` from
`chrome://extensions` for development. Production output is
`.output/chrome-mv3` after `npm run build`.

## Commands

| Command                  | Purpose                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ |
| `npm run dev`            | Start WXT development mode on port 5173.                                       |
| `npm run format`         | Format tracked source and configuration files.                                 |
| `npm run format:check`   | Check formatting without writes.                                               |
| `npm run lint`           | Run ESLint, React Hooks, and accessibility rules.                              |
| `npm run compile`        | Run strict TypeScript checking.                                                |
| `npm test`               | Run unit and contract tests with unexpected console output treated as failure. |
| `npm run test:coverage`  | Run V8 coverage and enforce global and core thresholds.                        |
| `npm run build`          | Build the production extension.                                                |
| `npm run check:manifest` | Validate the generated manifest contract.                                      |
| `npm run check:bundle`   | After `npm run zip`, enforce loader, ESM UI gzip, and zip budgets.             |
| `npm run test:e2e`       | Run Playwright against the production extension.                               |
| `npm run zip`            | Build the distributable extension archive.                                     |
| `npm run audit:high`     | Fail on high or critical dependency advisories.                                |
| `npm run validate`       | Run formatting, lint, type, unit/coverage, build, and manifest checks.         |

`npm run validate` does not run the extension E2E test, create or check the zip,
or audit dependencies. Use this release-validation sequence when those checks are
required:

```bash
npm run validate
npm run zip
npm run check:bundle
npm run test:e2e
npm run audit:high
```

## Unit and contract tests

Vitest uses the V8 provider. Global minimums are 80% for lines, statements, and
functions and 75% for branches. `src/domain` and `src/application` are checked at
90% lines/statements/functions and 85% branches. React tests enable the act
environment. Unexpected `console.error`, React warnings, and unhandled rejections
fail tests.

Browser lifecycle, GPU composition, and imperative DOM scrolling modules are
excluded from unit coverage. The Playwright extension flow loads the relevant
production paths, while real GPU animation and scrolling behavior remain part of
the manual smoke test. Render components, settings UI, adapters, runtime
validation, domain, and application logic remain in the global unit metric.

Manifest tests lock permissions, Spotify matches, disabled action state, popup,
and WAR scope. Bundle checks enforce:

- content gate raw size: at most 50 KiB;
- all ESM content UI JavaScript and CSS combined: at most 425 KiB gzip;
- final extension zip: at most 560 KiB.

## E2E

Install the Playwright bundled Chromium once:

```bash
npx playwright install chromium
```

`npm run test:e2e` uses one worker and a fresh persistent Chromium profile. It
loads `.output/chrome-mv3`, opens an `open.spotify.com` URL, and fulfills the page
with local DOM fixtures. Provider `fetch` calls are mocked at the extension
service-worker boundary. Assertions cover service-worker runtime messages, the
popup, content-gate loading, overlay mount/unmount, ShadowRoot styles, settings
persistence, cache clear, translation and LRCLIB provider flows, and the rule that
non-lyrics pages do not load the ESM UI.

## Manual English Spotify smoke

After automated validation, load `.output/chrome-mv3` and check the real English
Spotify Web Player:

1. The toolbar action is enabled only on Spotify.
2. A non-lyrics route does not request `content-scripts/esm/content.js`.
3. Opening lyrics mounts one styled Lyra ShadowRoot and hides the native display.
4. Spotify lyrics use the native active-line signal.
5. Missing or unsynced lyrics accept only an accurate LRCLIB match.
6. Changing track cancels stale work and displays only the new track.
7. Translation degradation keeps originals visible with an inline reason.
8. Target language, font size, and the Aurora motion preference survive reload.
9. A forced setting/cache failure shows a recoverable inline message.
10. Cache UI shows entries out of 200 and estimated size; clear resets both.
11. On a song with an `i.scdn.co` cover, the lyrics background changes to a
    derived palette once per cover URL; quick track changes do not apply a stale
    palette, and unsupported or low-color covers fall back silently.
12. Disabling dynamic background or enabling the operating system's reduced-motion
    preference stops Aurora motion while retaining the current cover palette.

Manual smoke requires an authenticated Spotify session and therefore cannot run
inside CI.
