// Commerce promises, checked against the real cart.
//
// Every surface that quotes a price or a saving (homepage pair band,
// /collections/the-pair, product page pair card and quantity rows, the bag
// drawer, the cart page, the phone sticky bar) is driven the way a customer
// drives it, and what it promised is compared with what Shopify's own
// discount engine then charges (/cart.js). Nothing here trusts a number the
// theme computed.
//
// Shopify facts these tests rely on (Discounts, verified with Shopify's own
// cart): GODA $30, HOYGI $25; "The ZOREV Pair · Save $8" (1 HOYGI + 1 GODA,
// once per order) — 1G+1H $47, 1G+2H $66, 1G+3H $93 (the pair drops: 3+
// HOYGI with fewer GODA); GODA 2/3 = $54/$76, HOYGI 2/3 = $44/$63, tiers once
// per order.
const { test, expect } = require('@playwright/test');
const { GODA, HOYGI, prep, go, clearCart, addItems, cart, discountTitles } = require('./helpers');

const PAIR = 'The ZOREV Pair · Save $8';
const OPTIONS = [
  { name: 'Black', id: GODA.black },
  { name: 'White', id: GODA.white },
  { name: 'Citrus', id: GODA.citrus },
  { name: 'Neutral', id: GODA.neutral },
];

const usd = cents => '$' + (cents / 100).toFixed(2);

// What the UI promised and what Shopify charged, kept as a test annotation
// (and, with ZV_QA_LOG=<file>, appended there as one JSON line) for the
// QA report's scenario table.
function record(testInfo, promise, c) {
  const row = { test: testInfo.title, project: testInfo.project.name, promise, total: usd(c.total_price),
                items: c.item_count, discounts: discountTitles(c) };
  testInfo.annotations.push({ type: 'cart', description: JSON.stringify(row) });
  if (process.env.ZV_QA_LOG) require('fs').appendFileSync(process.env.ZV_QA_LOG, JSON.stringify(row) + '\n');
}

function byVariant(c) {
  return c.items.reduce((m, i) => ({ ...m, [i.variant_id]: (m[i.variant_id] || 0) + i.quantity }), {});
}

// Every add the page itself sends (form posts and /cart/add.js), from the
// moment this is called. Requests the test makes with addItems() before it
// are not counted.
function watchAdds(page) {
  const posts = [];
  page.on('request', r => {
    if (r.method() !== 'POST') return;
    let p;
    try { p = new URL(r.url()).pathname; } catch (e) { return; }
    if (p === '/cart/add' || p === '/cart/add.js') posts.push({ path: p, body: r.postData() || '' });
  });
  return posts;
}

// A change in flight dims the drawer body (aria-busy); wait for it to settle.
async function drawerIdle(page) {
  await page.waitForFunction(() => !document.querySelector('[data-cd-body][aria-busy="true"]'));
}

async function openDrawer(page) {
  await page.locator('[data-cart-link]').click();
  const drawer = page.locator('[data-cart-drawer]');
  await expect(drawer).toHaveClass(/is-open/);
  await expect(drawer.locator('[data-cd-body] .cd__loading')).toHaveCount(0);
  return drawer;
}

test.describe('commerce: the pair', () => {
  test.beforeEach(async ({ page }) => { await prep(page); });

  for (const opt of OPTIONS) {
    test(`homepage pair band: ${opt.name} + HOYGI is one add and Shopify charges $47`, async ({ page }, testInfo) => {
      // Every option on a wide screen; one on a phone (same markup).
      test.skip(testInfo.project.name === 'mobile' && opt.name !== 'Citrus', 'one option on phones');
      await go(page, '/');
      const band = page.locator('#pair[data-zpr]');
      await band.scrollIntoViewIfNeeded();
      await expect(band).toHaveAttribute('data-state', 'offer');
      await expect(band.locator('[data-zpr-price]')).toContainText('$47');
      await expect(band.locator('[data-zpr-price]')).toContainText('$55');
      const btn = band.locator('[data-zpr-add]');
      await expect(btn).toHaveText('Add the pair · $47');
      await expect(band.locator('[data-zpr-note="offer"]')).toBeVisible();

      const radio = band.locator(`[data-zpr-opt][value="${opt.id}"]`);
      test.skip(await radio.count() === 0, `${opt.name} is sold out, so the band does not offer it`);
      await band.locator('.zpr__opt', { has: page.locator(`[data-zpr-opt][value="${opt.id}"]`) }).click();
      await expect(radio).toBeChecked();
      // the oil's packshot follows the option
      await expect(band.locator(`.zpp__stand[data-zpr-cut="${opt.id}"]`)).toBeVisible();
      expect(await band.locator('.zpp__stand[data-zpr-cut]:visible').count()).toBe(1);

      const posts = watchAdds(page);
      await btn.click();
      await expect(page.locator('[data-cart-drawer]')).toHaveClass(/is-open/);
      await expect.poll(() => posts.length).toBe(1);
      await page.waitForTimeout(1200); // a second add would have been sent by now
      expect(posts.length, 'one add per click').toBe(1);
      expect(JSON.parse(posts[0].body)).toEqual({ items: [{ id: opt.id, quantity: 1 }, { id: HOYGI.id, quantity: 1 }] });

      const j = await cart(page);
      record(testInfo, `band offer "Add the pair · $47" (${opt.name})`, j);
      expect(byVariant(j)).toEqual({ [opt.id]: 1, [HOYGI.id]: 1 });
      expect(j.total_price).toBe(4700);
      expect(discountTitles(j)).toContain(PAIR);
      await expect(page.locator('[data-cd-subtotal]')).toContainText(usd(j.total_price));
      // once per order: the band stops quoting the pair price
      await expect(band).toHaveAttribute('data-state', 'in-bag');
      await expect(btn).toHaveText('Add one of each');
    });
  }

  test('/collections/the-pair sells the pair: the offer, then one add that Shopify prices at $47', async ({ page }, testInfo) => {
    await go(page, '/collections/the-pair');
    await expect(page.locator('h1')).toContainText('The Pair');
    const band = page.locator('#pair[data-zpr]');
    await expect(band).toHaveCount(1);
    await band.scrollIntoViewIfNeeded();
    await expect(band).toHaveAttribute('data-state', 'offer');
    await expect(band.locator('[data-zpr-price]')).toContainText('$47');
    await expect(band.locator('[data-zpr-add]')).toHaveText('Add the pair · $47');
    await expect(page.locator('h2', { hasText: 'Or one at a time' })).toBeVisible();

    const radio = band.locator(`[data-zpr-opt][value="${GODA.white}"]`);
    await band.locator('.zpr__opt', { has: page.locator(`[data-zpr-opt][value="${GODA.white}"]`) }).click();
    await expect(radio).toBeChecked();
    const posts = watchAdds(page);
    await band.locator('[data-zpr-add]').click();
    await expect(page.locator('[data-cart-drawer]')).toHaveClass(/is-open/);
    await expect.poll(() => posts.length).toBe(1);
    await page.waitForTimeout(1200);
    expect(posts.length, 'one add per click').toBe(1);
    const j = await cart(page);
    record(testInfo, 'the-pair band "Add the pair · $47" (White)', j);
    expect(byVariant(j)).toEqual({ [GODA.white]: 1, [HOYGI.id]: 1 });
    expect(j.total_price).toBe(4700);
    expect(discountTitles(j)).toContain(PAIR);
  });

  test('blocked: with 2 HOYGI and no GODA nothing promises $47, and one of each costs what Shopify says ($93, no pair)', async ({ page }, testInfo) => {
    await go(page, '/');
    await addItems(page, [{ id: HOYGI.id, quantity: 2 }]);

    // homepage band
    await go(page, '/');
    const band = page.locator('#pair[data-zpr]');
    await band.scrollIntoViewIfNeeded();
    await expect(band).toHaveAttribute('data-state', 'blocked');
    const btn = band.locator('[data-zpr-add]');
    await expect(btn).toHaveText('Add one of each');
    await expect(band.locator('[data-zpr-note="blocked"]')).toBeVisible();
    await expect(band.locator('[data-zpr-price]')).toBeHidden();
    expect(await band.innerText(), 'no pair price or saving in the band').not.toMatch(/\$47|\$8\b|save \$/i);

    // both product pages: the pair card says the same, without figures
    for (const handle of [GODA.handle, HOYGI.handle]) {
      await go(page, '/products/' + handle);
      const card = page.locator('[data-pairc]');
      await expect(card).toHaveAttribute('data-state', 'blocked');
      await expect(card.locator('[data-pairc-add]')).toHaveText('Add one of each');
      await expect(card.locator('[data-pairc-price]')).toBeHidden();
      await expect(card.locator('[data-pairc-state]')).toContainText('more HOYGI than GODA');
      expect(await card.innerText(), handle).not.toMatch(/\$47|\$8\b|save \$/i);
    }

    // adding one of each from the band: Shopify's own price for 1G+3H
    await go(page, '/');
    await band.scrollIntoViewIfNeeded();
    await expect(band).toHaveAttribute('data-state', 'blocked');
    const before = (await cart(page)).total_price;
    expect(before).toBe(4400);
    const posts = watchAdds(page);
    await band.locator('[data-zpr-add]').click();
    const drawer = page.locator('[data-cart-drawer]');
    await expect(drawer).toHaveClass(/is-open/);
    await expect.poll(() => posts.length).toBe(1);
    const j = await cart(page);
    record(testInfo, 'band blocked: "Add one of each", no price (bag 2H)', j);
    expect(byVariant(j)).toEqual({ [GODA.black]: 1, [HOYGI.id]: 3 });
    expect(j.total_price).toBe(9300);
    expect(discountTitles(j)).not.toContain(PAIR);
    await expect(drawer.locator('[data-cd-subtotal]')).toContainText(usd(j.total_price));
    // the bag says plainly that the pair saving is not applied
    await expect(drawer.locator('[data-cd-pair]')).toContainText('Pair saving not applied');
  });

  test('2 HOYGI and no GODA: the bag offers GODA for $22 and Shopify charges exactly that ($66 with the pair)', async ({ page }, testInfo) => {
    await go(page, '/');
    await addItems(page, [{ id: HOYGI.id, quantity: 2 }]);
    await go(page, '/products/' + HOYGI.handle);
    const drawer = await openDrawer(page);
    const pair = drawer.locator('[data-cd-pair]');
    await expect(pair).toBeVisible();
    await expect(pair).toContainText('Add GODA and save $8');
    await expect(pair).toContainText('GODA for $22 with your HOYGI');
    const before = (await cart(page)).total_price;
    expect(before).toBe(4400);
    const posts = watchAdds(page);
    await pair.locator('[data-cd-pairadd]').click();
    await expect(pair).toContainText('You’re saving $8');
    expect(posts.length).toBe(1);
    const j = await cart(page);
    record(testInfo, 'drawer "GODA for $22 with your HOYGI" (bag 2H, $44)', j);
    expect(j.total_price - before, 'the increment the drawer promised').toBe(2200);
    expect(j.total_price).toBe(6600);
    expect(discountTitles(j)).toContain(PAIR);
    await expect(drawer.locator('[data-cd-subtotal]')).toContainText(usd(j.total_price));
  });
});

test.describe('commerce: cart page', () => {
  test.beforeEach(async ({ page }) => { await prep(page); await go(page, '/'); });

  test('pair form: 1 GODA White, "Add HOYGI" is exactly one add and Shopify charges $47', async ({ page }, testInfo) => {
    await addItems(page, [{ id: GODA.white, quantity: 1 }]);
    await go(page, '/cart');
    const offer = page.locator('[data-cart-pair]');
    await expect(offer).toContainText('Add HOYGI and save $8');
    await expect(offer).toContainText('$47 together');
    const posts = watchAdds(page);
    await offer.locator('[data-cart-pair-form] button[type="submit"]').click();
    await expect(page.locator('.zpair-ok')).toContainText('saving $8');
    await page.waitForTimeout(1500);
    expect(posts.length, 'one add per click').toBe(1);
    const j = await cart(page);
    record(testInfo, 'cart page "Add HOYGI · $47 together" (bag 1G White)', j);
    expect(byVariant(j)).toEqual({ [GODA.white]: 1, [HOYGI.id]: 1 });
    expect(j.total_price).toBe(4700);
    expect(discountTitles(j)).toContain(PAIR);
    await expect(page.locator('[data-cart-total]')).toContainText(usd(j.total_price));
    // the cart page is the bag: the drawer does not open over it
    await expect(page.locator('[data-cart-drawer]')).not.toHaveClass(/is-open/);
  });

  test('pair form: 1 HOYGI, choose Citrus, "Add GODA" is exactly one add and Shopify charges $47', async ({ page }, testInfo) => {
    await addItems(page, [{ id: HOYGI.id, quantity: 1 }]);
    await go(page, '/cart');
    const offer = page.locator('[data-cart-pair]');
    await expect(offer).toContainText('Add GODA and save $8');
    await expect(offer).toContainText('$47 together');
    await offer.locator('select[name="id"]').selectOption(String(GODA.citrus));
    const posts = watchAdds(page);
    await offer.locator('[data-cart-pair-form] button[type="submit"]').click();
    await expect(page.locator('.zpair-ok')).toContainText('saving $8');
    await page.waitForTimeout(1500);
    expect(posts.length, 'one add per click').toBe(1);
    const j = await cart(page);
    record(testInfo, 'cart page "Add GODA · $47 together" Citrus (bag 1H)', j);
    expect(byVariant(j)).toEqual({ [GODA.citrus]: 1, [HOYGI.id]: 1 });
    expect(j.total_price).toBe(4700);
    await expect(page.locator('[data-cart-total]')).toContainText(usd(j.total_price));
  });
});

test.describe('commerce: quantity offers are once per order', () => {
  test.beforeEach(async ({ page }) => { await prep(page); await go(page, '/'); });

  test('empty bag: the rows quote the tier savings and Shopify honours them', async ({ page }, testInfo) => {
    await go(page, '/products/' + GODA.handle);
    const qo = page.locator('[data-qo]');
    await expect(qo).not.toHaveClass(/is-plain/);
    await expect(qo.locator('[data-qo-total="2"]')).toHaveText('$54');
    await expect(qo.locator('[data-qo-total="3"]')).toHaveText('$76');
    await expect(qo).toContainText('Save $6');
    await expect(qo).toContainText('Save $14');
    await expect(page.locator('[data-note-auto]')).toBeVisible();
    await expect(page.locator('[data-note-bag]')).toBeHidden();
    await qo.locator('.qo__in[value="3"]').check({ force: true });
    await expect(page.locator('#zpf-main [data-add]')).toHaveText('Add 3 to bag · $76');
    await page.locator('#zpf-main [data-add]').click();
    await expect(page.locator('[data-cart-drawer]')).toHaveClass(/is-open/);
    const j = await cart(page);
    record(testInfo, 'PDP "Add 3 to bag · $76" (empty bag)', j);
    expect(j.item_count).toBe(3);
    expect(j.total_price).toBe(7600);
  });

  test('GODA already in the bag: the rows stop promising savings, the add costs what Shopify says, an empty bag brings them back', async ({ page }, testInfo) => {
    await addItems(page, [{ id: GODA.black, quantity: 1 }]);
    await go(page, '/products/' + GODA.handle);
    const qo = page.locator('[data-qo]');
    await expect(qo).toHaveClass(/is-plain/);
    await expect(qo.locator('[data-qo-total="2"]')).toHaveText('$60');
    await expect(qo.locator('[data-qo-total="3"]')).toHaveText('$90');
    expect(await qo.innerText(), 'no row claims a saving').not.toMatch(/save|best value|each/i);
    await expect(page.locator('[data-note-bag]')).toBeVisible();
    await expect(page.locator('[data-note-bag]')).toContainText('Savings are worked out in your bag.');
    await expect(page.locator('[data-note-auto]')).toBeHidden();
    await qo.locator('.qo__in[value="2"]').check({ force: true });
    const atc = page.locator('#zpf-main [data-add]');
    await expect(atc).toHaveText('Add 2 to bag · $60');
    const before = (await cart(page)).total_price;
    await atc.click();
    const drawer = page.locator('[data-cart-drawer]');
    await expect(drawer).toHaveClass(/is-open/);
    const j = await cart(page);
    record(testInfo, 'PDP plain "Add 2 to bag · $60", no saving claimed (bag 1G)', j);
    expect(j.item_count).toBe(3);
    expect(j.total_price).toBe(7600); // Shopify: 3 GODA = $76
    // the label quoted full price; the customer is never charged more than it said
    expect(j.total_price - before).toBeLessThanOrEqual(6000);
    await expect(drawer.locator('[data-cd-subtotal]')).toContainText(usd(j.total_price));

    // empty the bag from the drawer: the rows quote the savings again
    await drawerIdle(page);
    while (await drawer.locator('.cd__line').count()) {
      await drawer.locator('.cd__line').first().locator('[data-cd-dir="rm"]').click();
      await drawerIdle(page);
    }
    await expect(drawer.locator('[data-cd-empty-focus]')).toBeVisible();
    await expect(qo).not.toHaveClass(/is-plain/);
    await expect(qo).toContainText('Save $6');
    await expect(qo.locator('[data-qo-total="2"]')).toHaveText('$54');
    expect((await cart(page)).item_count).toBe(0);
  });

  test('HOYGI already in the bag with the pair: plain rows, and the bag shows Shopify\'s result when the pair drops ($93)', async ({ page }, testInfo) => {
    await addItems(page, [{ id: GODA.black, quantity: 1 }, { id: HOYGI.id, quantity: 1 }]);
    await go(page, '/products/' + HOYGI.handle);
    const qo = page.locator('[data-qo]');
    await expect(qo).toHaveClass(/is-plain/);
    await expect(qo.locator('[data-qo-total="2"]')).toHaveText('$50');
    expect(await qo.innerText()).not.toMatch(/save|best value|each/i);
    await expect(page.locator('[data-pairc]')).toHaveAttribute('data-state', 'in-bag');
    await qo.locator('.qo__in[value="2"]').check({ force: true });
    await expect(page.locator('#zpf-main [data-add]')).toHaveText('Add 2 to bag · $50');
    await page.locator('#zpf-main [data-add]').click();
    const drawer = page.locator('[data-cart-drawer]');
    await expect(drawer).toHaveClass(/is-open/);
    const j = await cart(page);
    record(testInfo, 'HOYGI PDP plain "Add 2 to bag · $50" (bag 1G+1H)', j);
    expect(byVariant(j)).toEqual({ [GODA.black]: 1, [HOYGI.id]: 3 });
    expect(j.total_price).toBe(9300);
    expect(discountTitles(j)).not.toContain(PAIR);
    await expect(drawer.locator('[data-cd-subtotal]')).toContainText(usd(j.total_price));
    await expect(drawer.locator('[data-cd-pair]')).toContainText('Pair saving not applied');
    // and the product page's pair card no longer says the pair is in the bag
    await expect(page.locator('[data-pairc]')).toHaveAttribute('data-state', 'blocked');
  });
});

test.describe('commerce: bag drawer', () => {
  test.beforeEach(async ({ page }) => { await prep(page); await go(page, '/'); });

  test('+, −, Remove and empty: every total is Shopify\'s and focus stays put', async ({ page }, testInfo) => {
    await addItems(page, [{ id: GODA.black, quantity: 1 }, { id: HOYGI.id, quantity: 1 }]);
    await go(page, '/products/' + HOYGI.handle);
    const drawer = await openDrawer(page);
    await expect(drawer.locator('[data-cd-subtotal]')).toContainText('$47.00');
    await expect(drawer.locator('[data-cd-pair]')).toContainText('You’re saving $8');

    // + on HOYGI: 1G+2H, $66, pair still on
    await drawer.locator('.cd__line', { hasText: 'Hoygi' }).first().locator('[data-cd-dir="inc"]').click();
    await drawerIdle(page);
    let j = await cart(page);
    record(testInfo, 'drawer + on HOYGI (1G+1H -> 1G+2H)', j);
    expect(j.item_count).toBe(3);
    expect(j.total_price).toBe(6600);
    expect(discountTitles(j)).toContain(PAIR);
    await expect(drawer.locator('[data-cd-subtotal]')).toContainText(usd(j.total_price));
    expect(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-cd-dir'))).toBe('inc');
    await expect(page.locator('[data-cart-count-text]').first()).toHaveText('3 items');

    // − on HOYGI: back to $47
    await drawer.locator('.cd__line', { hasText: 'Hoygi' }).first().locator('[data-cd-dir="dec"]').click();
    await drawerIdle(page);
    j = await cart(page);
    record(testInfo, 'drawer − on HOYGI (-> 1G+1H)', j);
    expect(j.item_count).toBe(2);
    expect(j.total_price).toBe(4700);
    await expect(drawer.locator('[data-cd-subtotal]')).toContainText(usd(j.total_price));

    // Remove GODA: 1 HOYGI, $25, and the bag offers GODA "$47 together"
    await drawer.locator('.cd__line', { hasText: 'GODA' }).locator('[data-cd-dir="rm"]').click();
    await drawerIdle(page);
    j = await cart(page);
    record(testInfo, 'drawer Remove GODA (-> 1H), offer "$47 together"', j);
    expect(byVariant(j)).toEqual({ [HOYGI.id]: 1 });
    expect(j.total_price).toBe(2500);
    await expect(drawer.locator('[data-cd-subtotal]')).toContainText('$25.00');
    await expect(drawer.locator('[data-cd-pair]')).toContainText('$47 together');
    expect(await page.evaluate(() => document.activeElement && document.activeElement.className)).toMatch(/cd__name/);

    // Remove the last line: the empty bag
    await drawer.locator('.cd__line').first().locator('[data-cd-dir="rm"]').click();
    await drawerIdle(page);
    await expect(drawer.locator('[data-cd-empty-focus]')).toBeVisible();
    await expect(drawer.locator('[data-cd-empty-focus]')).toBeFocused();
    await expect(drawer.locator('[data-cd-foot]')).toBeHidden();
    await expect(drawer.locator('[data-cd-pair]')).toBeHidden();
    expect((await cart(page)).item_count).toBe(0);
    await expect(page.locator('[data-cart-count-text]').first()).toHaveText('0 items');

    // Escape closes and focus returns to the bag link that opened it
    await page.keyboard.press('Escape');
    await expect(drawer).not.toHaveClass(/is-open/);
    await expect(page.locator('[data-cart-link]')).toBeFocused();
  });
});

test.describe('commerce: product page', () => {
  test.beforeEach(async ({ page }) => { await prep(page); });

  test('phone sticky bar mirrors option, quantity and price, and adds that option and quantity', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'phones only');
    await go(page, '/products/' + GODA.handle);
    const bar = page.locator('[data-zsatc]');
    await expect(bar).not.toHaveClass(/is-on/);
    const citrus = page.locator(`.vopt__in[data-variant-id="${GODA.citrus}"]`);
    await page.locator('.vopt', { has: citrus }).click();
    await expect(citrus).toBeChecked();
    await page.locator('[data-qo] .qo__in[value="2"]').check({ force: true });
    await expect(page.locator('#zpf-main [data-add]')).toHaveText('Add 2 to bag · $54');

    // scroll until the real form has left the screen
    await page.evaluate(() => {
      const a = document.querySelector('[data-zatc-anchor]');
      window.scrollTo(0, window.scrollY + a.getBoundingClientRect().bottom + 40);
    });
    await expect(bar).toHaveClass(/is-on/);
    expect(await page.locator('[data-zatc-anchor]').evaluate(a => a.getBoundingClientRect().bottom)).toBeLessThan(0);
    await expect(bar.locator('[data-satc-opt]')).toHaveText('Citrus (men’s)');
    await expect(bar.locator('[data-satc-sum]')).toHaveText('2 bottles · $54');
    await expect(page.locator('#zpf-sticky [name="id"]')).toHaveValue(String(GODA.citrus));
    await expect(page.locator('#zpf-sticky [data-qo-mirror]')).toHaveValue('2');
    expect(JSON.parse(await page.locator('#zpf-sticky').getAttribute('data-items'))).toEqual([{ id: GODA.citrus, quantity: 2 }]);

    const posts = watchAdds(page);
    await bar.locator('[data-add]').click();
    await expect(page.locator('[data-cart-drawer]')).toHaveClass(/is-open/);
    await expect.poll(() => posts.length).toBe(1);
    const j = await cart(page);
    record(testInfo, 'sticky "Citrus (men’s) · 2 bottles · $54"', j);
    expect(byVariant(j)).toEqual({ [GODA.citrus]: 2 });
    expect(j.total_price).toBe(5400);

    // back at the form, the bar gets out of the way
    await page.keyboard.press('Escape');
    await page.locator('[data-zatc-anchor]').evaluate(a => a.scrollIntoView({ block: 'center' }));
    await expect(bar).not.toHaveClass(/is-on/);
  });

  test('?variant= link: that option\'s photograph is first, painted first, and the gallery never slides past others', async ({ page }, testInfo) => {
    // Sample the track's scroll position from the first frame on.
    await page.addInitScript(() => {
      window.__zvSL = [];
      const t0 = Date.now();
      const tick = () => {
        const t = document.querySelector('[data-gal-track]');
        if (t) window.__zvSL.push(t.scrollLeft);
        if (Date.now() - t0 < 4000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await go(page, '/products/' + GODA.handle + '?variant=' + GODA.citrus);
    const first = page.locator('.gal__slide').first();
    await expect(first).toHaveAttribute('data-variant', new RegExp(String(GODA.citrus)));
    await expect(first.locator('img')).toHaveAttribute('fetchpriority', 'high');
    await expect(first.locator('img')).toHaveAttribute('alt', /Citrus/);
    await expect(page.locator(`.vopt__in[data-variant-id="${GODA.citrus}"]`)).toBeChecked();
    await expect(page.locator('#zpf-main [name="id"]')).toHaveValue(String(GODA.citrus));
    await page.waitForTimeout(1500);
    const sl = await page.evaluate(() => window.__zvSL);
    expect(sl.length).toBeGreaterThan(5);
    expect(Math.max(...sl), 'track never scrolled during load').toBe(0);
    const cur = page.locator('.gal__thumb[aria-current="true"]:visible, .gal__dot[aria-current="true"]:visible');
    await expect(cur).toHaveCount(1);
    await expect(cur).toHaveAttribute('aria-label', /Citrus.*1 of/);
    expect(page.url()).toContain('variant=' + GODA.citrus);
  });

  test('thumbnails change only the gallery: no page scroll, no text selection, no option change', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'thumbnails are the wide-screen control');
    await go(page, '/products/' + GODA.handle);
    const thumbs = page.locator('.gal__thumb');
    expect(await thumbs.count()).toBeGreaterThanOrEqual(4);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(400);
    const y0 = await page.evaluate(() => window.scrollY);
    const startId = await page.locator('#zpf-main [name="id"]').inputValue();
    const url0 = page.url();

    // a real mouse at the thumbnail's position (locator.click would scroll it into view first)
    const center = async i => {
      const b = await thumbs.nth(i).boundingBox();
      expect(b.y + b.height, 'thumbnail on screen').toBeLessThan(page.viewportSize().height);
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    let p = await center(2);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(y0);
    await expect(thumbs.nth(2)).toHaveAttribute('aria-current', 'true');
    const at = await page.evaluate(() => {
      const t = document.querySelector('[data-gal-track]');
      const s = t.querySelectorAll('.gal__slide')[2];
      return Math.abs(s.getBoundingClientRect().left - t.getBoundingClientRect().left);
    });
    expect(at).toBeLessThan(3);

    p = await center(3);
    await page.mouse.dblclick(p.x, p.y);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(y0);
    expect(await page.evaluate(() => String(window.getSelection())), 'no text selected').toBe('');
    await expect(thumbs.nth(3)).toHaveAttribute('aria-current', 'true');
    // the selection is the customer's, not the gallery's
    await expect(page.locator('#zpf-main [name="id"]')).toHaveValue(startId);
    await expect(page.locator(`.vopt__in[data-variant-id="${startId}"]`)).toBeChecked();
    expect(page.url()).toBe(url0);
  });
});
