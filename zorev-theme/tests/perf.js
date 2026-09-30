// Usage: node perf.js <baseUrl> [preview_theme_id] [path]
// Loads a page as a mid-range phone would (4x CPU slowdown, ~9 Mbps / 150 ms
// RTT) and reports Largest Contentful Paint, Cumulative Layout Shift, what
// the LCP element is, and how many bytes of each type came down. The store's
// own analytics and third-party pixels are blocked, as in the other tests,
// so the numbers are the theme's.
const { chromium } = require('@playwright/test');
const transport = require('./specs/transport');
const base = process.argv[2] || 'https://www.zorev.org';
const previewId = process.argv[3] || '';
const path = process.argv[4] || '/';
const BLOCK = /google-analytics|googletagmanager|monorail|web-pixels|\/wpm@|preloads\.js|standard-actions|origin_trials|remote_product_tracking|load_feature|portable-wallets|checkouts\/internal|judge\.me|jdgm|challenge-platform|\.well-known\/shopify|\/api\/collect|\/api\/event|\/api\/unstable\/graphql|privacy-banner|consent-tracking/;

(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({ ...(proxy ? { proxy: { server: proxy } } : {}), args: ['--ignore-certificate-errors'] });
  const mobile = process.env.DESKTOP !== '1';
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
  const page = await ctx.newPage();
  await transport.install(page, new URL(base).host, BLOCK);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 9 * 1024 * 1024 / 8, uploadThroughput: 1.5 * 1024 * 1024 / 8 });
  const bytes = {};
  cdp.on('Network.loadingFinished', e => { bytes[e.requestId] = Object.assign(bytes[e.requestId] || {}, { size: e.encodedDataLength }); });
  cdp.on('Network.responseReceived', e => { bytes[e.requestId] = Object.assign(bytes[e.requestId] || {}, { type: e.type, url: e.response.url }); });
  await page.addInitScript(() => {
    window.__lcp = null; window.__cls = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = { t: e.startTime, el: e.element ? (e.element.tagName + '.' + (e.element.className || '') + ' ' + (e.element.currentSrc || e.element.src || '').split('?')[0].split('/').pop()) : null }; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  const url = base + path + (previewId ? (path.includes('?') ? '&' : '?') + 'preview_theme_id=' + previewId : '');
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(3000);
  // frames the page manages while the hero animates on its own, and while
  // the page is being scrolled (depth and reveals running), CPU slowed 4x
  const fps = await page.evaluate(async () => {
    const count = ms => new Promise(res => { let n = 0; const t0 = performance.now(); (function f(t) { n++; if (t - t0 < ms) requestAnimationFrame(f); else res(Math.round(n * 1000 / (t - t0))); })(t0); });
    const idle = await count(3000);
    let y = 0; const iv = setInterval(() => { y += 40; window.scrollTo(0, y); }, 16);
    const scrolling = await count(3000);
    clearInterval(iv); window.scrollTo(0, 0);
    return { idle, scrolling };
  });
  // one slow scroll to the bottom and back, so lazy media and shifts count
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls, dom: document.getElementsByTagName('*').length, theme: window.Shopify && window.Shopify.theme && window.Shopify.theme.id }));
  const byType = {};
  let total = 0;
  for (const b of Object.values(bytes)) { if (!b.size) continue; total += b.size; const k = b.type || 'Other'; byType[k] = (byType[k] || 0) + b.size; }
  const kb = n => Math.round(n / 1024) + ' KB';
  console.log(JSON.stringify({ path, mobile, theme: r.theme, loadMs: Date.now() - t0, lcpMs: r.lcp && Math.round(r.lcp.t), lcpEl: r.lcp && r.lcp.el, cls: Number(r.cls.toFixed(4)), fps, domNodes: r.dom, total: kb(total), byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, kb(v)])) }));
  if (process.env.TOP) {
    Object.values(bytes).filter(b => b.size).sort((a, b) => b.size - a.size).slice(0, Number(process.env.TOP))
      .forEach(b => console.log(String(Math.round(b.size / 1024)).padStart(6) + ' KB  ' + (b.type || '') + '  ' + (b.url || '').split('?')[0].slice(-90)));
  }
  await browser.close();
})();
