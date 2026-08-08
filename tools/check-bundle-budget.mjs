import { gzipSync } from 'node:zlib';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDir = resolve('.output/chrome-mv3');
const loaderPath = resolve(outputDir, 'content-scripts/content.js');
const esmDir = resolve(outputDir, 'content-scripts/esm');
const loaderBytes = (await stat(loaderPath)).size;
if (loaderBytes > 50 * 1024) {
  throw new Error(`Content gate is ${loaderBytes} bytes; budget is 50 KiB.`);
}

const esmFiles = (await readdir(esmDir)).filter((name) =>
  /\.(?:js|css)$/.test(name),
);
let esmGzipBytes = 0;
for (const name of esmFiles) {
  esmGzipBytes += gzipSync(await readFile(resolve(esmDir, name))).byteLength;
}
if (esmGzipBytes > 425 * 1024) {
  throw new Error(`ESM UI is ${esmGzipBytes} gzip bytes; budget is 425 KiB.`);
}

const zipFiles = (await readdir(resolve('.output'))).filter((name) =>
  name.endsWith('.zip'),
);
if (zipFiles.length === 0)
  throw new Error('No extension zip found. Run npm run zip first.');
const newestZip = zipFiles.at(-1);
const zipBytes = (await stat(resolve('.output', newestZip))).size;
if (zipBytes > 560 * 1024) {
  throw new Error(`Extension zip is ${zipBytes} bytes; budget is 560 KiB.`);
}

console.log(
  `Bundle budgets passed: loader=${loaderBytes} B, ESM gzip=${esmGzipBytes} B, zip=${zipBytes} B.`,
);
