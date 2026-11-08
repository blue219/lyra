import { expect, test, chromium, type BrowserContext } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

declare const chrome: {
  runtime: { sendMessage(message: unknown): Promise<any> };
  storage: {
    local: {
      get(key: string): Promise<Record<string, any>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
};

const extensionPath = resolve('.output/chrome-mv3');
const spotifyFixture = await readFile(
  resolve('e2e/fixtures/spotify.html'),
  'utf8',
);
const homeFixture =
  '<!doctype html><html lang="en"><body><main>Home</main></body></html>';

test('production extension flow', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'lyra-playwright-'));
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    const requestedUrls: string[] = [];
    context.on('request', (request) => requestedUrls.push(request.url()));
    await context.route('https://open.spotify.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: route.request().url().endsWith('/lyrics')
          ? spotifyFixture
          : homeFixture,
      }),
    );
    const serviceWorker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(serviceWorker.url()).host;
    await serviceWorker.evaluate(async () => {
      globalThis.fetch = async (input) => {
        const url = String(input);
        if (url.startsWith('https://translate.googleapis.com/')) {
          return new Response(
            JSON.stringify([
              [['Bonjour[[LYRA_LINE_BREAK_8B4B4F0D]]Monde', 'Hello']],
              null,
              'en',
            ]),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url.startsWith('https://lrclib.net/')) {
          return new Response(
            JSON.stringify([
              {
                id: 1,
                trackName: 'Song',
                artistName: 'Artist',
                duration: 180,
                instrumental: false,
                syncedLyrics: '[00:01.00] Hello',
              },
            ]),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response('', { status: 404 });
      };
      await chrome.storage.local.set({
        overlaySettings: {
          targetLanguage: 'fr-FR',
          fontSize: 'md',
          dynamicBackground: false,
        },
      });
    });
    await expect(
      serviceWorker.evaluate(async () =>
        (
          await fetch(
            'https://translate.googleapis.com/translate_a/single?probe=1',
          )
        ).json(),
      ),
    ).resolves.toEqual([
      [['Bonjour[[LYRA_LINE_BREAK_8B4B4F0D]]Monde', 'Hello']],
      null,
      'en',
    ]);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    const translated = await popup.evaluate(async () =>
      chrome.runtime.sendMessage({
        type: 'lyra:translateLyrics',
        source: 'spotify',
        targetLanguage: 'fr-FR',
        lines: [
          { timeMs: 0, original: 'Hello' },
          { timeMs: 1, original: 'World' },
        ],
      }),
    );
    expect(translated).toMatchObject({
      status: 'available',
      lines: [{ translated: 'Bonjour' }, { translated: 'Monde' }],
    });

    const page = await context.newPage();
    await page.goto('https://open.spotify.com/home');
    await page.waitForTimeout(400);
    expect(
      requestedUrls.some((url) =>
        url.includes('/content-scripts/esm/content.js'),
      ),
    ).toBe(false);

    await page.goto('https://open.spotify.com/lyrics');
    await expect(page.locator('lyra-overlay')).toBeAttached();
    await expect(
      page.locator('[data-lyra-replacement-host="true"]'),
    ).toBeAttached();
    await expect(
      page.locator('[data-testid="lyrics-line"]').first(),
    ).toHaveAttribute('data-lyra-native-lyrics-hidden', 'true');
    expect(
      requestedUrls.some((url) =>
        url.includes('/content-scripts/esm/content.js'),
      ),
    ).toBe(true);

    const shadowHasStyles = await page
      .locator('lyra-overlay')
      .evaluate((host) =>
        [...(host.shadowRoot?.querySelectorAll('style') ?? [])].some((style) =>
          style.textContent?.includes('--lyra-color-accent'),
        ),
      );
    expect(shadowHasStyles).toBe(true);

    await expect(page.getByText('Bonjour')).toBeVisible();
    await expect(page.getByText('Bonjour')).toHaveCSS('font-weight', '600');
    await page.getByRole('button', { name: 'Open Lyra settings' }).click();
    const dynamicBackgroundToggle = page.getByRole('switch', {
      name: 'Toggle dynamic background',
    });
    await expect(dynamicBackgroundToggle).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await dynamicBackgroundToggle.click();
    await expect(dynamicBackgroundToggle).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(dynamicBackgroundToggle.locator('span')).toHaveCSS(
      'right',
      '4px',
    );
    await expect(dynamicBackgroundToggle.locator('span')).toHaveCSS(
      'top',
      '4px',
    );
    const summary = await popup.evaluate(async () =>
      chrome.runtime.sendMessage({ type: 'lyra:getLyricsCacheSummary' }),
    );
    expect(summary.entryCount).toBeGreaterThan(0);
    await popup.evaluate(async () =>
      chrome.runtime.sendMessage({ type: 'lyra:clearLyricsCache' }),
    );
    const cleared = await popup.evaluate(async () =>
      chrome.runtime.sendMessage({ type: 'lyra:getLyricsCacheSummary' }),
    );
    expect(cleared.entryCount).toBe(0);

    await page.evaluate(() => {
      document
        .querySelectorAll('[data-testid="lyrics-line"]')
        .forEach((element) => element.remove());
      const notice = document.createElement('p');
      notice.textContent = "These lyrics aren't synced to the song yet.";
      document.querySelector('main')?.append(notice);
    });
    await expect(page.getByText('Source: LRCLIB')).toBeVisible();

    await expect(popup.locator('#lyra-target-language')).toHaveValue('fr-FR');
    await popup.locator('#lyra-target-language').selectOption('de-DE');
    await expect
      .poll(() =>
        serviceWorker.evaluate(
          async () =>
            (await chrome.storage.local.get('overlaySettings')).overlaySettings
              ?.targetLanguage,
        ),
      )
      .toBe('de-DE');

    await page.goto('https://open.spotify.com/home');
    await expect(page.locator('lyra-overlay')).toHaveCount(0);

    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        `<aside data-testid="lyrics-npv-section">
          <div data-testid="lyrics-line">Preview</div>
        </aside>
        <div aria-label="Now playing: Song by Artist">
          <a href="/track/song">Song</a><a href="/artist/artist">Artist</a>
        </div>`,
      );
    });
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div id="cinema-toolbar" style="--header-text-color: white; position: absolute; transition: opacity 100ms">Toolbar</div>
        <div id="cinema" data-overlayscrollbars="host" style="position: relative; overflow: hidden; width: 100%; height: 400px">
          <div data-overlayscrollbars-viewport style="height: 100%; overflow-y: scroll">
            <div style="--cinema-mode-bg-color-from: #121212">
              <div style="--lyrics-color-background: #121212; padding-top: 200px; height: 900px">
                <div data-testid="lyrics-line" aria-current="true">Hello</div>
                <div data-testid="lyrics-line">World</div>
              </div>
            </div>
          </div>
        </div>`,
      );
      document
        .querySelectorAll('#cinema [data-testid="lyrics-line"]')
        .forEach((line) =>
          line.addEventListener('click', () => {
            document
              .querySelector('#cinema')
              ?.setAttribute('data-seeked', line.textContent ?? '');
          }),
        );
    });
    const cinema = page.locator('#cinema');
    const lyricsFrame = cinema.locator(
      ':scope > [data-lyra-replacement-host] > [data-lyra-replacement-scroll]',
    );
    await expect(lyricsFrame).toBeVisible();
    await expect(lyricsFrame).toHaveCSS('height', '336px');
    await expect(cinema.locator('[data-overlayscrollbars-viewport]')).toHaveCSS(
      'opacity',
      '0',
    );
    await expect(page.getByRole('button', { name: /Preview/ })).toHaveCount(0);
    const world = lyricsFrame.getByRole('button', { name: /World/ });
    await cinema.locator('[data-testid="lyrics-line"]').evaluateAll((lines) => {
      lines[0]?.removeAttribute('aria-current');
      lines[1]?.setAttribute('aria-current', 'true');
    });
    await expect(world).toHaveAttribute('data-lyra-replacement-active', 'true');
    await world.click();
    await expect(cinema).toHaveAttribute('data-seeked', 'World');

    const cinemaToolbar = page.locator('#cinema-toolbar');
    await cinemaToolbar.evaluate((toolbar) => (toolbar.style.opacity = '0'));
    await expect(lyricsFrame).toHaveCSS('height', '400px');
    await cinemaToolbar.evaluate((toolbar) => (toolbar.style.opacity = '1'));
    await expect(lyricsFrame).toHaveCSS('height', '336px');

    await page.evaluate(() => {
      const fullscreen = document.createElement('button');
      fullscreen.textContent = 'Enter cinema fullscreen';
      fullscreen.onclick = () => void document.body.requestFullscreen();
      document.body.prepend(fullscreen);
    });
    await page.getByRole('button', { name: 'Enter cinema fullscreen' }).click();
    await expect(page.locator('body:fullscreen')).toBeAttached();
    await expect(lyricsFrame).toHaveCSS('height', '400px');
    const cinemaSettings = page.getByRole('button', {
      name: 'Open Lyra settings',
    });
    await cinemaSettings.click();
    await expect(dynamicBackgroundToggle).toBeVisible();
    await cinemaSettings.click();

    await page.evaluate(() => document.exitFullscreen());
    await expect(lyricsFrame).toHaveCSS('height', '336px');

    await page.setViewportSize({ width: 390, height: 700 });
    await expect(lyricsFrame).toHaveCSS('width', '374px');
    await expect(lyricsFrame).toHaveCSS('height', '336px');

    await cinema.evaluate((element) => element.remove());
    await expect(page.locator('lyra-overlay')).toHaveCount(0);
    await expect(page.getByText('Preview')).toBeVisible();
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
