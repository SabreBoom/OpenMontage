// Shared helpers. Product and variant ids are the real store's; prices are
// the store's intended offers and are asserted against what Shopify's own
// cart returns, never against numbers the theme computes.
const transport = require('./transport');

const PREVIEW = process.env.PREVIEW_THEME_ID || '';

const GODA = { handle: 'goda-pheromone-perfume-oil', product_id: 9424930930939, black: 49337208045819, white: 49337208078587, citrus: 49337208111355, neutral: 49337208144123, price: 4000 };
const HOYGI = { handle: 'hoygi-calcium-multi-balm', product_id: 9424931160315, id: 49337209258235, price: 2500 };

// Third-party and Shopify analytics traffic: beacons, pixels, consent and
// the storefront's own telemetry POSTs (monorail batches, /api/collect,
// fec/produce). None of it is under test, and on this store its volume
// alone is enough to trip the cart endpoints' rate limiting.
const BLOCK = /google-analytics|googletagmanager|monorail|web-pixels|\/wpm@|preloads\.js|shopifycloud\/shop-js|standard-actions|origin_trials|remote_product_tracking|load_feature|portable-wallets|checkouts\/internal|judge\.me|jdgm|challenge-platform|\.well-known\/shopify|\/api\/collect|\/api\/unstable\/graphql|privacy-banner|consent-tracking/;

function withPreview(path) {
  if (!PREVIEW) return path;
  return path + (path.includes('?') ? '&' : '?') + 'preview_theme_id=' + PREVIEW;
}

const STORE_HOST = new URL(process.env.BASE_URL || 'https://www.zorev.org').host;

async function prep(page) {
  // Third-party beacons make "networkidle" unreachable and add nothing to
  // what is under test. Console errors from these are not the theme's.
  // The store's own dynamic requests go through transport.js (see there
  // for why); the real cart and the real discount engine are what answer.
  await transport.install(page, STORE_HOST, BLOCK);
}

async function go(page, path, opts) {
  await page.goto(withPreview(path), { waitUntil: 'domcontentloaded', ...(opts || {}) });
  await page.waitForSelector('main');
  await page.waitForLoadState('load').catch(() => {});
}

// Cart calls go through the page's own fetch, exactly as the theme's JS does.
// A bare API request context trips Shopify's bot protection (429
// "Verifying your connection"); in-page fetch carries the browser's cookies
// and fingerprint. 429s that still happen under load are retried with
// backoff — they are rate limiting, not a pricing result.
async function api(page, path, method, body) {
  let last;
  for (let attempt = 0; attempt < 5; attempt++) {
    last = await page.evaluate(async ([p, m, b]) => {
      const res = await fetch(p, {
        method: m,
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: b == null ? undefined : JSON.stringify(b),
      });
      return { status: res.status, ok: res.ok, text: await res.text() };
    }, [path, method, body === undefined ? null : body]);
    if (last.status !== 429) break;
    await page.waitForTimeout(2000 * (attempt + 1));
  }
  if (!last.ok) throw new Error(path + ' failed ' + last.status + ' ' + last.text.slice(0, 200));
  return JSON.parse(last.text);
}

async function clearCart(page) {
  return api(page, '/cart/clear.js', 'POST');
}

async function addItems(page, items) {
  return api(page, '/cart/add.js', 'POST', { items });
}

async function cart(page) {
  return api(page, '/cart.js', 'GET');
}

function discountTitles(c) {
  const out = new Set();
  (c.items || []).forEach(i => (i.line_level_discount_allocations || []).forEach(a => out.add(a.discount_application.title)));
  (c.cart_level_discount_applications || []).forEach(d => out.add(d.title));
  return [...out];
}

async function noOverflow(page) {
  return page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
}

module.exports = { GODA, HOYGI, PREVIEW, withPreview, prep, go, clearCart, addItems, cart, discountTitles, noOverflow };
