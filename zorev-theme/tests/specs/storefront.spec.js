// Storefront behaviour: product page, quantity selector, bag drawer, pair
// upsell, cart page, navigation, gallery, accordions, forms, layout.
const { test, expect } = require('@playwright/test');
const { GODA, HOYGI, prep, go, clearCart, addItems, cart, noOverflow } = require('./helpers');

test.describe('storefront', () => {
  // Each test runs in a new browser context with its own cookie jar, so its
  // cart is new and empty; nothing is cleared before or after.
  test.beforeEach(async ({ page }) => { await prep(page); await go(page, '/'); });

  test('homepage renders every section, no hidden reveals, no overflow', async ({ page }) => {
    await go(page, '/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('#line')).toBeVisible();
    await expect(page.locator('#pair')).toBeVisible();
    // clean cutouts, not the maker's infographics, on the homepage
    expect(await page.locator('img.zv-cut').count()).toBeGreaterThanOrEqual(4);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(800);
    const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-zv-reveal]')].filter(e => getComputedStyle(e).opacity === '0').length);
    expect(hidden).toBe(0);
    const o = await noOverflow(page); expect(o.sw).toBeLessThanOrEqual(o.cw);
    // hero CTAs point at real anchors
    for (const href of await page.locator('a[href^="#"]').evaluateAll(a => a.map(x => x.getAttribute('href')))) {
      if (href === '#') continue;
      expect(await page.locator(href).count(), href).toBeGreaterThan(0);
    }
  });

  test('GODA product page: quantity selector mirrors Shopify pricing and adds the chosen quantity', async ({ page }) => {
    await go(page, '/products/' + GODA.handle);
    await expect(page.locator('h1')).toContainText('GODA');
    const qo = page.locator('[data-qo]');
    await expect(qo).toBeVisible();
    await expect(qo.locator('[data-qo-total="1"]')).toHaveText('$40');
    await expect(qo.locator('[data-qo-total="2"]')).toHaveText('$70');
    await expect(qo.locator('[data-qo-total="3"]')).toHaveText('$104');
    await expect(qo).toContainText('Save $10');
    await expect(qo).toContainText('Save $16');
    await qo.locator('.qo__in[value="2"]').check({ force: true });
    await expect(page.locator('#zpf-main [data-add]')).toContainText('Add 2 to bag · $70');
    await page.locator('#zpf-main [data-add]').click();
    const drawer = page.locator('[data-cart-drawer]');
    await expect(drawer).toHaveClass(/is-open/);
    await expect(drawer.locator('[data-cd-savings]')).toContainText('GODA · Buy 2 · Save $10');
    await expect(drawer.locator('[data-cd-subtotal]')).toContainText('$70.00');
    const j = await cart(page);
    expect(j.item_count).toBe(2); expect(j.total_price).toBe(7000);
  });

  test('GODA product page: two or three bottles can each be a different option, and the saving still applies', async ({ page }) => {
    await go(page, '/products/' + GODA.handle);
    const mix = page.locator('[data-qmix]');
    await expect(mix).toBeHidden(); // one bottle: the option above is the choice
    await page.locator('.opt[data-variant-id]').nth(1).click(); // White
    await page.locator('[data-qo] .qo__in[value="3"]').check({ force: true });
    await expect(mix).toBeVisible();
    const sels = mix.locator('[data-qmix-sel]');
    await expect(mix.locator('[data-qmix-row]:visible')).toHaveCount(3);
    // every bottle starts on the option chosen above
    for (let i = 0; i < 3; i++) await expect(sels.nth(i)).toHaveValue(String(GODA.white));
    await sels.nth(0).selectOption(String(GODA.black));
    await sels.nth(2).selectOption(String(GODA.citrus));
    await expect(page.locator('#zpf-main [data-add]')).toContainText('Add 3 to bag · $104');
    await page.locator('#zpf-main [data-add]').click();
    await expect(page.locator('[data-cart-drawer]')).toHaveClass(/is-open/);
    const j = await cart(page);
    const byVariant = j.items.reduce((m, i) => ({ ...m, [i.variant_id]: (m[i.variant_id] || 0) + i.quantity }), {});
    expect(byVariant).toEqual({ [GODA.black]: 1, [GODA.white]: 1, [GODA.citrus]: 1 });
    expect(j.total_price).toBe(10400);
  });

  test('HOYGI product page: 3 sticks = $63 and the tier is named in the bag', async ({ page }) => {
    await go(page, '/products/' + HOYGI.handle);
    await expect(page.locator('[data-qmix]')).toHaveCount(0); // one option only: nothing to choose
    await page.locator('[data-qo] .qo__in[value="3"]').check({ force: true });
    await expect(page.locator('#zpf-main [data-add]')).toContainText('$63');
    await page.locator('#zpf-main [data-add]').click();
    await expect(page.locator('[data-cart-drawer]')).toHaveClass(/is-open/);
    await expect(page.locator('[data-cd-savings]')).toContainText('HOYGI · Buy 3 · Save $12');
    expect((await cart(page)).total_price).toBe(6300);
  });

  test('variant change updates the gallery and the pair button', async ({ page }) => {
    await go(page, '/products/' + GODA.handle);
    const opts = page.locator('.opt[data-variant-id]');
    expect(await opts.count()).toBe(4);
    await opts.nth(1).click();
    await expect(opts.nth(1)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#zpf-main input[name="id"]')).toHaveValue(String(GODA.white));
    // the pair card follows the chosen option
    await expect(page.locator('[data-pairc-add]')).toHaveAttribute('data-a', String(GODA.white));
    // gallery: one slide per option, the second one now current
    const slides = page.locator('.gal__slide');
    expect(await slides.count()).toBeGreaterThanOrEqual(4);
    await page.waitForTimeout(700);
    const current = await page.locator('.gal__thumb[aria-current="true"], .gal__dot[aria-current="true"]').first().getAttribute('aria-label');
    expect(current).toMatch(/2/);
  });

  test('pair upsell: offered with GODA only, confirmed once HOYGI is added, absent with 2 HOYGI and no GODA', async ({ page }) => {
    await addItems(page, [{ id: GODA.black, quantity: 1 }]);
    await go(page, '/products/' + GODA.handle);
    await page.locator('[data-cart-link]').click();
    const drawer = page.locator('[data-cart-drawer]');
    await expect(drawer).toHaveClass(/is-open/);
    const pair = drawer.locator('[data-cd-pair]');
    await expect(pair).toContainText('Complete your ZOREV Pair');
    await expect(pair).toContainText('Add HOYGI and save $6');
    await pair.locator('[data-cd-pairadd]').click();
    await expect(pair).toContainText("You’re saving $6");
    await expect(pair).not.toContainText('Complete your');
    const j = await cart(page);
    expect(j.total_price).toBe(5900);
    // the product page card also knows the pair is in the bag
    await expect(page.locator('[data-pairc]')).toHaveAttribute('data-state', 'in-bag');

    await clearCart(page);
    await addItems(page, [{ id: HOYGI.id, quantity: 2 }]);
    await go(page, '/products/' + HOYGI.handle);
    await page.locator('[data-cart-link]').click();
    await expect(drawer).toHaveClass(/is-open/);
    await page.waitForTimeout(800);
    await expect(drawer.locator('[data-cd-pair]')).toBeHidden();
    await expect(page.locator('[data-pairc]')).toHaveAttribute('data-state', 'blocked');
  });

  test('cart page: quantity change updates in place without a reload, remove empties the bag', async ({ page }) => {
    await addItems(page, [{ id: GODA.black, quantity: 1 }, { id: HOYGI.id, quantity: 1 }]);
    await go(page, '/cart');
    await page.evaluate(() => { window.__zorevNoReload = true; });
    await expect(page.locator('[data-cart-total]')).toContainText('$59.00');
    await expect(page.locator('.zpair-ok')).toContainText('saving $6');
    await page.locator('.zline').first().locator('[data-qty][aria-label="Increase quantity"]').click();
    await expect(page.locator('[data-cart-total]')).not.toContainText('$59.00');
    expect(await page.evaluate(() => window.__zorevNoReload)).toBe(true);
    const j = await cart(page); expect(j.item_count).toBe(3);
    await expect(page.locator('[data-cart-total]')).toContainText('$' + (j.total_price / 100).toFixed(2));
    // remove everything; the lines block pointer events (aria-busy) while a
    // change is in flight, which is the double-submit guard working
    const idle = () => page.waitForFunction(() => !document.querySelector('[data-cart-lines][aria-busy="true"]'));
    while (await page.locator('.zline').count()) {
      await idle();
      const before = await page.locator('.zline').count();
      await page.locator('.zline').first().getByRole('button', { name: 'Remove' }).click();
      await page.waitForFunction(n => document.querySelectorAll('.zline').length < n, before);
    }
    await expect(page.locator('.zcart__empty')).toBeVisible();
    await expect(page.locator('.zcart__empty a.btn').first()).toBeVisible();
  });

  test('checkout button exists in drawer and cart page', async ({ page }) => {
    await addItems(page, [{ id: HOYGI.id, quantity: 1 }]);
    await go(page, '/cart');
    const go2 = page.locator('form[action$="/cart"] button[name="checkout"]');
    await expect(go2.first()).toBeVisible();
    await expect(go2.first()).toBeEnabled();
  });

  test('accordions and trust lines on the product page', async ({ page }) => {
    await go(page, '/products/' + HOYGI.handle);
    const accs = page.locator('details.acc');
    expect(await accs.count()).toBeGreaterThanOrEqual(4);
    const second = accs.nth(1);
    await second.locator('summary').click();
    await expect(second).toHaveAttribute('open', '');
    await expect(page.locator('.trust2')).toContainText('Secure checkout');
    await expect(page.locator('.trust2')).not.toContainText('30-day');
    await expect(page.locator('.trust2')).not.toContainText('money-back');
  });

  test('contact form has labelled fields', async ({ page }) => {
    await go(page, '/pages/contact');
    await expect(page.locator('label[for="cf-email"]')).toBeVisible();
    await expect(page.locator('#cf-email')).toHaveAttribute('required', '');
    await expect(page.locator('label[for="cf-body"]')).toBeVisible();
  });

  test('no legacy pair pricing anywhere on the key pages', async ({ page }) => {
    for (const path of ['/', '/products/' + GODA.handle, '/products/' + HOYGI.handle, '/cart', '/collections/the-pair', '/pages/faq']) {
      await go(page, path);
      const text = await page.locator('body').innerText();
      expect(text, path).not.toMatch(/\$84|\$14\b|Take both/i);
    }
  });
});

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => { await prep(page); });

  test('header links and the mobile menu work', async ({ page }, testInfo) => {
    await go(page, '/');
    if (testInfo.project.name === 'mobile') {
      const burger = page.locator('[data-nav-toggle]');
      await expect(burger).toBeVisible();
      await burger.click();
      await expect(burger).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#zhdr-drawer')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(burger).toHaveAttribute('aria-expanded', 'false');
    } else {
      await expect(page.locator('.zhdr__nav a', { hasText: 'Shop' })).toBeVisible();
      await page.locator('.zhdr__nav a', { hasText: 'About' }).click();
      await expect(page).toHaveURL(/about-us/);
      await expect(page.locator('h1')).toContainText('About');
    }
  });

  test('footer links resolve', async ({ page }) => {
    await go(page, '/');
    const hrefs = await page.locator('.ftr a[href^="/"]').evaluateAll(a => [...new Set(a.map(x => x.getAttribute('href')))]);
    expect(hrefs.length).toBeGreaterThan(4);
    for (const h of hrefs) {
      // In-page fetch, so the browser's session (not a bare API context) is
      // what Shopify sees; a 429 here is rate limiting, so retry once.
      let status = await page.evaluate(async u => (await fetch(u, { credentials: 'same-origin' })).status, h);
      if (status === 429) { await page.waitForTimeout(3000); status = await page.evaluate(async u => (await fetch(u, { credentials: 'same-origin' })).status, h); }
      expect(status, h).toBeLessThan(400);
    }
  });

  test('sticky add-to-bag appears on phones once the button scrolls away', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'phones only');
    await go(page, '/products/' + GODA.handle);
    const bar = page.locator('[data-zsatc]');
    await expect(bar).not.toHaveClass(/is-on/);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
    await page.waitForTimeout(500);
    await expect(bar).toHaveClass(/is-on/);
    const box = await bar.boundingBox();
    expect(box.height).toBeGreaterThan(50);
  });
});

test.describe('layout at every width', () => {
  const widths = [360, 375, 390, 412, 768, 1024, 1280, 1440, 1920];
  const paths = ['/', '/products/' + GODA.handle, '/products/' + HOYGI.handle, '/cart'];
  for (const w of widths) {
    test(`no horizontal overflow at ${w}px`, async ({ browser }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'run once');
      const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : 900 }, isMobile: w < 700, hasTouch: w < 700, ignoreHTTPSErrors: true });
      const page = await ctx.newPage();
      await prep(page);
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      for (const p of paths) {
        await go(page, p);
        const o = await noOverflow(page);
        expect(o.sw, `${p} @ ${w}`).toBeLessThanOrEqual(o.cw);
      }
      // Only the theme's own errors count: Shopify's shop-js loader imports
      // its modules from cdn.shopify.com and reports its own failures as
      // uncaught, which the theme neither loads nor can influence.
      expect(errors.filter(e => !/cdn\.shopify\.com\/shopifycloud/.test(e)), 'uncaught JS errors').toEqual([]);
      await ctx.close();
    });
  }
});

test.describe('reduced motion', () => {
  test('the film hero and every depth layer are still', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await prep(page);
    await go(page, '/');
    await page.mouse.move(900, 300);
    await page.evaluate(() => window.scrollTo(0, 1600));
    await page.waitForTimeout(600);
    const s = await page.evaluate(() => ({
      breathe: getComputedStyle(document.querySelector('.zhf__breathe')).animationName,
      mist: getComputedStyle(document.querySelector('.zhf__mist--far')).animationName,
      moved: [...document.querySelectorAll('[data-zv-depth]')].filter(e => e.style.transform).length,
      videos: [...document.querySelectorAll('video[data-zv-video]')].filter(v => !v.paused).length,
    }));
    expect(s.breathe).toBe('none');
    expect(s.mist).toBe('none');
    expect(s.moved).toBe(0);
    expect(s.videos).toBe(0);
    await ctx.close();
  });
});

test.describe('film homepage', () => {
  test.beforeEach(async ({ page }) => { await prep(page); });

  test('hero is a real photograph with the copy on it, and it moves only when motion is welcome', async ({ page }) => {
    await go(page, '/');
    const hero = page.locator('.zhf');
    await expect(hero).toBeVisible();
    await expect(hero.locator('h1')).toContainText('wherever');
    const img = hero.locator('.zhf__breathe img');
    await expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(await img.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
    expect(await page.locator('.zhf__breathe').evaluate(el => getComputedStyle(el).animationName)).toBe('zhf-breathe');
    // the first screen is the hero: it fills the viewport under the header
    const box = await hero.boundingBox();
    const vh = page.viewportSize().height;
    expect(box.y + box.height).toBeGreaterThan(vh * 0.9);
  });

  test('each product has its own chapter with the real ladder', async ({ page }) => {
    await go(page, '/');
    const goda = page.locator('#goda');
    const hoygi = page.locator('#hoygi');
    await expect(goda).toContainText('$40');
    await expect(goda.locator('.zps__ladder')).toContainText('$70');
    await expect(goda.locator('.zps__ladder')).toContainText('$104');
    await expect(goda.locator('.zps__ladder')).toContainText('Save $10');
    await expect(goda.locator('.zps__ladder')).toContainText('Save $16');
    await expect(hoygi.locator('.zps__ladder')).toContainText('$44');
    await expect(hoygi.locator('.zps__ladder')).toContainText('$63');
    await expect(hoygi.locator('.zps__ladder')).toContainText('Save $6');
    await expect(hoygi.locator('.zps__ladder')).toContainText('Save $12');
    await expect(goda.locator('a.zv-btn')).toHaveAttribute('href', /goda-pheromone-perfume-oil/);
    await expect(hoygi.locator('a.zv-btn')).toHaveAttribute('href', /hoygi-calcium-multi-balm/);
  });

  test('chapter copy keeps a readable column on every screen width', async ({ page }, testInfo) => {
    // The copy column once shrank as the screen grew (a max-width that also
    // had to hold the page margin): ~220 px at 1920, a letter wide beyond.
    await go(page, '/');
    const widths = testInfo.project.name === 'mobile' ? [page.viewportSize().width] : [1024, 1440, 1920, 2560, 3440];
    for (const w of widths) {
      if (testInfo.project.name !== 'mobile') await page.setViewportSize({ width: w, height: 900 });
      const m = await page.evaluate(() => [...document.querySelectorAll('.zps')].map(s => {
        const c = s.querySelector('.zps__copy'); const cs = getComputedStyle(c);
        const lines = el => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size; };
        return {
          id: s.id,
          text: c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
          wrappedFacts: [...s.querySelectorAll('.zps__fact dt')].filter(dt => lines(dt) > 1).map(dt => dt.textContent.trim()),
          wrappedRows: [...s.querySelectorAll('.zps__q')].filter(q => lines(q) > 1).length,
        };
      }));
      for (const s of m) {
        expect(s.text, `${s.id} copy width at ${w}px`).toBeGreaterThanOrEqual(Math.min(320, w - 60));
        expect(s.wrappedFacts, `${s.id} facts on one line at ${w}px`).toEqual([]);
        expect(s.wrappedRows, `${s.id} ladder rows on one line at ${w}px`).toBe(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });

  test('Made to move: four scenes; on a phone a strip that scrolls sideways and reports progress', async ({ page }, testInfo) => {
    await go(page, '/');
    const mm = page.locator('#made-to-move');
    await expect(mm.locator('.zmm__item')).toHaveCount(4);
    const track = mm.locator('[data-zv-strip-track]');
    if (testInfo.project.name === 'mobile') {
      // scrollable, so it is a labelled, focusable region
      await expect(track).toHaveAttribute('tabindex', '0');
      await track.scrollIntoViewIfNeeded();
      const before = await mm.locator('[data-zv-strip-bar]').evaluate(b => b.style.transform);
      await track.evaluate(t => t.scrollTo({ left: t.scrollWidth, behavior: 'instant' }));
      await page.waitForTimeout(300);
      const after = await mm.locator('[data-zv-strip-bar]').evaluate(b => b.style.transform);
      expect(before).not.toBe(after);
      // the browser normalises the inline value (1.000 -> 1), so compare numbers
      const scale = v => parseFloat((/scaleX\(([\d.]+)\)/.exec(v) || [])[1]);
      expect(scale(before)).toBeLessThan(1);
      expect(scale(after)).toBeCloseTo(1, 2);
    } else {
      // nothing to scroll on a wide screen, so no dead tab stop either
      expect(await track.evaluate(t => t.scrollWidth <= t.clientWidth + 1)).toBe(true);
      await expect(track).not.toHaveAttribute('tabindex', /.*/);
    }
  });

  test('real media never shows staged footage: honest empty state until a permitted clip exists', async ({ page }) => {
    await go(page, '/');
    const rm = page.locator('#real');
    await expect(rm).toBeVisible();
    await expect(rm).toHaveClass(/zrm--empty/);
    expect(await rm.locator('video, .zrm__item').count()).toBe(0);
    await expect(rm).toContainText('we will not stage it');
  });

  test('product page shows its own in-use scene and never the other product\'s', async ({ page }) => {
    await go(page, '/products/' + GODA.handle);
    await expect(page.locator('.zpsc')).toHaveCount(1);
    expect(await page.locator('.zpsc img').getAttribute('alt')).toMatch(/GODA/);
    expect(await page.locator('.gal__slide--photo img').evaluateAll(a => a.map(i => i.alt).join('|'))).not.toMatch(/Hoygi/i);
    await go(page, '/products/' + HOYGI.handle);
    await expect(page.locator('.zpsc')).toHaveCount(1);
    expect(await page.locator('.zpsc img').getAttribute('alt')).toMatch(/Hoygi/);
    expect(await page.locator('.gal__slide--photo img').evaluateAll(a => a.map(i => i.alt).join('|'))).not.toMatch(/GODA/);
  });
});
