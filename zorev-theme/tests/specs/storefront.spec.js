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

  test('HOYGI product page: 3 sticks = $63 and the tier is named in the bag', async ({ page }) => {
    await go(page, '/products/' + HOYGI.handle);
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
    // remove everything
    while (await page.locator('.zline').count()) {
      await page.locator('.zline').first().getByRole('button', { name: 'Remove' }).click();
      await page.waitForTimeout(600);
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
  test('hero and stage objects do not animate', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await prep(page);
    await go(page, '/');
    const anim = await page.locator('.zhp__obj').first().evaluate(el => getComputedStyle(el).animationName);
    expect(anim).toBe('none');
    const transformed = await page.evaluate(() => [...document.querySelectorAll('[data-zv-depth]')].filter(e => e.style.transform).length);
    expect(transformed).toBe(0);
    await ctx.close();
  });
});
