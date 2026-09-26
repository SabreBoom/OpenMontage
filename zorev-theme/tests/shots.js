// Usage: node shots.js <baseUrl> <outDir> [preview_theme_id]
//   PREVIEW_THEME_ID=1234 npm run shots   (defaults: https://www.zorev.org, shots/)
//   env WIDTHS=360,1440  PAGES=home,goda,hoygi,cart,cartfull,drawer,menu,pair,faq
// Full-page screenshots of the theme with Shopify's cookie banner dismissed and
// the preview bar hidden, plus interactive states: a bag with items, the open
// cart drawer after Add to bag, and the mobile menu.
const { chromium } = require('@playwright/test');
const transport = require('./specs/transport');
const base = process.argv[2] || process.env.BASE_URL || 'https://www.zorev.org';
const out = process.argv[3] || 'shots';
const previewId = process.argv[4] || process.env.PREVIEW_THEME_ID || '';
const fs = require('fs'); fs.mkdirSync(out, { recursive: true });
const GODA_BLACK = 49337208045819, HOYGI = 49337209258235;
const allPages = {
  home: { path: '/' },
  goda: { path: '/products/goda-pheromone-perfume-oil' },
  hoygi: { path: '/products/hoygi-calcium-multi-balm' },
  cart: { path: '/cart' },
  cartfull: { path: '/cart', items: [{ id: GODA_BLACK, quantity: 2 }, { id: HOYGI, quantity: 1 }] },
  drawer: { path: '/products/hoygi-calcium-multi-balm', items: [{ id: GODA_BLACK, quantity: 1 }], action: 'drawer', viewportOnly: true },
  menu: { path: '/', action: 'menu', viewportOnly: true, mobileOnly: true },
  pair: { path: '/collections/the-pair' },
  all: { path: '/collections/all' },
  faq: { path: '/pages/faq' },
};
const pages = (process.env.PAGES || 'home,goda,hoygi,cart,cartfull,drawer,menu').split(',').map(k => [k, allPages[k]]);
const widths = (process.env.WIDTHS || '360,375,390,412,768,1024,1280,1440,1920').split(',').map(Number);
// Same list as specs/helpers.js: analytics and telemetry that is not under
// test and whose volume alone trips the store's rate limiting.
const BLOCK = /google-analytics|googletagmanager|monorail|web-pixels|\/wpm@|preloads\.js|shopifycloud\/shop-js|standard-actions|origin_trials|remote_product_tracking|load_feature|portable-wallets|checkouts\/internal|judge\.me|jdgm|challenge-platform|\.well-known\/shopify|\/api\/collect|\/api\/unstable\/graphql|privacy-banner|consent-tracking/;
const withPreview = p => base + p + (previewId ? (p.includes('?') ? '&' : '?') + 'preview_theme_id=' + previewId : '');

async function settle(page) {
  await page.waitForSelector('main', { timeout: 20000 });
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  // Shopify's own privacy banner and preview bar are not the theme's; clear them.
  await page.addStyleTag({ content: '#preview-bar-iframe, #PBarNextFrameWrapper { display: none !important; }' }).catch(() => {});
  const decline = page.locator('#shopify-pc__banner__btn-decline');
  if (await decline.count()) await decline.first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function shoot(browser, w, name, spec) {
  const mobile = w < 700;
  if (spec.mobileOnly && !mobile) return { name, w, skipped: true };
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: w, height: mobile ? 844 : 900 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 ZorevQA' });
  const page = await ctx.newPage();
  // Store documents and cart calls go through curl (see specs/transport.js).
  await transport.install(page, new URL(base).host, BLOCK);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  let res = { name, w };
  try {
    await page.goto(withPreview('/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await settle(page);
    // Real cart, real discount engine: the bag is set through Shopify's AJAX API from the page itself.
    await page.evaluate(async () => { await fetch('/cart/clear.js', { method: 'POST', credentials: 'same-origin' }); });
    if (spec.items) {
      const r = await page.evaluate(async items => { const x = await fetch('/cart/add.js', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items }) }); return x.status; }, spec.items);
      res.addStatus = r;
    }
    if (spec.path !== '/') { await page.goto(withPreview(spec.path), { waitUntil: 'domcontentloaded', timeout: 45000 }); await settle(page); }
    if (spec.action === 'drawer') {
      await page.locator('#zpf-main [data-add]').click();
      await page.waitForSelector('[data-cart-drawer].is-open', { timeout: 15000 });
      await page.waitForTimeout(900);
    } else if (spec.action === 'menu') {
      await page.locator('[data-nav-toggle]').click();
      await page.waitForTimeout(700);
    } else {
      await page.evaluate(async () => {
        const h = document.documentElement.scrollHeight; const step = Math.max(400, window.innerHeight * 0.8);
        for (let y = 0; y < h; y += step) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); }
        window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 500));
      });
    }
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight, theme: (window.Shopify && window.Shopify.theme && window.Shopify.theme.id), hidden: [...document.querySelectorAll('[data-zv-reveal]')].filter(e => getComputedStyle(e).opacity === '0').length, imgsBroken: [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.src).length, plates: document.querySelectorAll('.zv-cut--plate').length, cuts: document.querySelectorAll('.zv-cut').length, liquidErrors: (document.body.innerText.match(/Liquid error/g) || []).length }));
    await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: !spec.viewportOnly });
    res = { ...res, overflow: m.sw > m.cw ? `${m.sw}>${m.cw}` : 'ok', h: m.h, theme: m.theme, hiddenReveals: m.hidden, brokenImgs: m.imgsBroken, plates: m.plates, cuts: m.cuts, liquidErrors: m.liquidErrors, errors };
    await page.evaluate(async () => { await fetch('/cart/clear.js', { method: 'POST', credentials: 'same-origin' }); }).catch(() => {});
  } catch (e) { res.error = String(e).slice(0, 200); }
  await ctx.close();
  return res;
}
(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({ ...(proxy ? { proxy: { server: proxy } } : {}), args: ['--ignore-certificate-errors'] });
  for (const w of widths) for (const [name, spec] of pages) {
    let r = await shoot(browser, w, name, spec);
    if (r.error) { await new Promise(x => setTimeout(x, 4000)); r = await shoot(browser, w, name, spec); }
    console.log(JSON.stringify(r));
  }
  await browser.close();
})();
