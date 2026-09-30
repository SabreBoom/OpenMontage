// Usage: node record.js <baseUrl> <outDir> [preview_theme_id]
// Records the homepage as a visitor sees it, motion on: the hero at rest for
// a few seconds (breathing plate, mist, light), then a slow scroll through
// the page. One recording per width (WIDTHS=1440,390). Playwright writes
// WebM; the file plays in any browser.
const { chromium } = require('@playwright/test');
const transport = require('./specs/transport');
const fs = require('fs');
const base = process.argv[2] || 'https://www.zorev.org';
const out = process.argv[3] || 'recordings';
const previewId = process.argv[4] || '';
const widths = (process.env.WIDTHS || '1440,390').split(',').map(Number);
const BLOCK = /google-analytics|googletagmanager|monorail|web-pixels|\/wpm@|preloads\.js|standard-actions|origin_trials|remote_product_tracking|load_feature|portable-wallets|checkouts\/internal|judge\.me|jdgm|challenge-platform|\.well-known\/shopify|\/api\/collect|\/api\/event|\/api\/unstable\/graphql|privacy-banner|consent-tracking/;
fs.mkdirSync(out, { recursive: true });

(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({ ...(proxy ? { proxy: { server: proxy } } : {}), args: ['--ignore-certificate-errors'] });
  for (const w of widths) {
    const mobile = w < 700;
    const size = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: size, isMobile: mobile, hasTouch: mobile, recordVideo: { dir: out, size } });
    const page = await ctx.newPage();
    await transport.install(page, new URL(base).host, BLOCK);
    await page.goto(base + '/' + (previewId ? '?preview_theme_id=' + previewId : ''), { waitUntil: 'load', timeout: 90000 });
    await page.addStyleTag({ content: '#preview-bar-iframe, #PBarNextFrameWrapper { display: none !important; }' }).catch(() => {});
    const decline = page.locator('#shopify-pc__banner__btn-decline');
    if (await decline.count()) await decline.first().click({ timeout: 3000 }).catch(() => {});
    if (!mobile) { await page.mouse.move(700, 420); }
    // the hero at rest, with a slow pointer drift on desktop
    for (let i = 0; i < 40; i++) {
      if (!mobile) await page.mouse.move(700 + Math.sin(i / 6) * 160, 420 + Math.cos(i / 8) * 60);
      await page.waitForTimeout(150);
    }
    // a slow scroll through the whole page
    await page.evaluate(async () => {
      const H = document.documentElement.scrollHeight - window.innerHeight;
      for (let y = 0; y <= H; y += 14) { window.scrollTo(0, y); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 16))); }
    });
    await page.waitForTimeout(800);
    const v = page.video();
    await ctx.close();
    const p = await v.path();
    const dest = `${out}/zorev-v12-home-${w}.webm`;
    fs.renameSync(p, dest);
    console.log(dest, Math.round(fs.statSync(dest).size / 1024) + ' KB');
  }
  await browser.close();
})();
