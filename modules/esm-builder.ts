import { resolve } from 'node:path';
import type { ContentScriptEntrypoint } from 'wxt';
import { defineWxtModule } from 'wxt/modules';
import { build, mergeConfig, type InlineConfig } from 'vite';

export default defineWxtModule((wxt) => {
  let baseViteConfig: InlineConfig;
  let contentEntrypoint: ContentScriptEntrypoint;

  wxt.hooks.hook('vite:build:extendConfig', ([entrypoint], config) => {
    if (entrypoint?.name === 'content') baseViteConfig = config;
  });

  wxt.hooks.hook('entrypoints:resolved', (_, entrypoints) => {
    contentEntrypoint = entrypoints.find(
      (entrypoint) => entrypoint.name === 'content',
    ) as ContentScriptEntrypoint;
  });

  const buildEsmContent = async () => {
    const config = mergeConfig(baseViteConfig, {
      build: {
        lib: {
          entry: resolve(wxt.config.entrypointsDir, 'content/esm-index.tsx'),
          fileName: 'content',
          formats: ['es'],
          name: '_content',
        },
        rollupOptions: {
          output: {
            entryFileNames: 'content.js',
            assetFileNames: '[name][extname]',
          },
        },
        outDir: resolve(wxt.config.outDir, 'content-scripts/esm'),
      },
    } satisfies InlineConfig);
    await build(config);
  };

  wxt.hooks.hook('build:done', buildEsmContent);
  wxt.hooks.hookOnce('build:done', () => {
    const esmBase = resolve(wxt.config.entrypointsDir, 'content');
    const esmSourceRoots = [esmBase, resolve(wxt.config.root, 'src')];
    const ignored = resolve(esmBase, 'index.ts');
    wxt.server?.watcher.on('all', async (_, file) => {
      if (
        !esmSourceRoots.some((root) => file.startsWith(root)) ||
        file === ignored
      )
        return;
      await buildEsmContent();
      wxt.server?.reloadContentScript({
        contentScript: {
          matches: contentEntrypoint.options.matches,
          js: ['/content-scripts/content.js'],
        },
      });
    });
  });

  wxt.hooks.hook('build:manifestGenerated', (_, manifest) => {
    manifest.web_accessible_resources ??= [];
    // WXT's cross-manifest union incorrectly intersects MV2 and MV3 WAR types.
    // @ts-expect-error The object is the valid MV3 shape and WXT converts it for MV2.
    manifest.web_accessible_resources.push({
      matches: ['https://open.spotify.com/*'],
      resources: ['/content-scripts/esm/*'],
    });
  });

  wxt.hooks.hook('prepare:publicPaths', (_, paths) => {
    paths.push(
      'content-scripts/esm/content.js',
      'content-scripts/esm/content.css',
    );
  });
});
