// Author: Rasel Al Mamun
// Share images (1.7.0): the og:image of a project or post page, 1200 × 630, made at build time from
// its card image (1600 × 900) by a centred cover crop — the card images keep their subject in the
// centre band, so the crop keeps it. The crop is drawn in the Chromium that Playwright (a dev
// dependency already) installs for the tests, so the build needs no image library of its own.
// Only the pixels leave the source file; the image is never sent anywhere.
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { chromium } from '@playwright/test';

export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;

const MIME = { '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png' };

// items: [{ name, file }] → Map(name → JPEG Buffer). One browser for the whole list.
export async function makeShareImages(items) {
  const images = new Map();
  if (!items.length) return images;
  let browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    throw new Error(
      `share images: Chromium could not start (${error.message.split('\n')[0]}). Run "npx playwright install chromium" once.`,
      { cause: error },
    );
  }
  try {
    const page = await browser.newPage();
    for (const { name, file } of items) {
      const source = `data:${MIME[extname(file)] ?? 'image/webp'};base64,${readFileSync(file).toString('base64')}`;
      // This function runs in the browser page, where Image and document exist.
      /* eslint-disable no-undef */
      const jpeg = await page.evaluate(
        async ({ source: src, width, height }) => {
          const image = new Image();
          image.src = src;
          await image.decode();
          // Cover: scale to fill the frame, centre the crop.
          const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
          const w = image.naturalWidth * scale;
          const h = image.naturalHeight * scale;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          context.imageSmoothingQuality = 'high';
          context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
          return canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
        },
        { source, width: SHARE_WIDTH, height: SHARE_HEIGHT },
      );
      /* eslint-enable no-undef */
      images.set(name, Buffer.from(jpeg, 'base64'));
    }
  } finally {
    await browser.close();
  }
  return images;
}
