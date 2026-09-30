// Usage: node a11y.js <baseUrl> [preview_theme_id]
// Runs axe-core (WCAG 2.0, 2.1 and 2.2, levels A and AA) on the key pages at
// a phone and a desktop width, and prints every violation with its impact,
// how many elements it hits and the first few selectors. Shopify's own
// preview bar and privacy banner are excluded: they are not the theme's.
const { chromium } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const transport = require('./specs/transport');
const base = process.argv[2] || 'https://www.zorev.org';
const previewId = process.argv[3] || '';
const pages = (process.env.PAGES || '/,/products/goda-pheromone-perfume-oil,/products/hoygi-calcium-multi-balm,/cart').split(',');
const widths = (process.env.WIDTHS || '390,1440').split(',').map(Number);
const BLOCK = /google-analytics|googletagmanager|monorail|web-pixels|\/wpm@|preloads\.js|standard-actions|origin_trials|remote_product_tracking|load_feature|portable-wallets|checkouts\/internal|judge\.me|jdgm|challenge-platform|\.well-known\/shopify|\/api\/collect|\/api\/event|\/api\/unstable\/graphql|privacy-banner|consent-tracking/;

(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({ ...(proxy ? { proxy: { server: proxy } } : {}), args: ['--ignore-certificate-errors'] });
  let total = 0;
  for (const w of widths) {
    const mobile = w < 700;
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: w, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await transport.install(page, new URL(base).host, BLOCK);
    for (const p of pages) {
      const url = base + p + (previewId ? (p.includes('?') ? '&' : '?') + 'preview_theme_id=' + previewId : '');
      await page.goto(url, { waitUntil: 'load', timeout: 90000 });
      await page.waitForTimeout(1500);
      // scroll once so lazy media and reveals are in their final state
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(800);
      const r = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .exclude('#preview-bar-iframe').exclude('#PBarNextFrameWrapper').exclude('#shopify-pc__banner').exclude('shopify-payment-terms')
        .analyze();
      total += r.violations.length;
      console.log(JSON.stringify({ page: p, w, violations: r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map(n => n.target.join(' ')) })), passes: r.passes.length }));
    }
    await ctx.close();
  }
  console.log('violation types total:', total);
  await browser.close();
})();
