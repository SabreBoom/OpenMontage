// Real cart pricing. Every expectation is checked against /cart.js, which
// is Shopify's discount engine talking — the theme never computes these.
const { test, expect } = require('@playwright/test');
const { GODA, HOYGI, prep, go, addItems, cart, discountTitles } = require('./helpers');

test.describe('Shopify discount engine', () => {
  // Each test runs in a new browser context with its own cookie jar, so its
  // cart is new and empty; nothing is cleared before or after.
  test.beforeEach(async ({ page }) => { await prep(page); await go(page, '/'); });

  const cases = [
    { name: 'GODA x1 = $40',            items: [{ id: GODA.black, quantity: 1 }], total: 4000, saved: 0 },
    { name: 'GODA x2 = $70 (save $10)', items: [{ id: GODA.black, quantity: 2 }], total: 7000, saved: 1000, title: 'GODA · Buy 2 · Save $10' },
    { name: 'GODA x3 = $104 (save $16)', items: [{ id: GODA.black, quantity: 3 }], total: 10400, saved: 1600, title: 'GODA · Buy 3 · Save $16' },
    { name: 'GODA Black + White = $70 (tiers span options)', items: [{ id: GODA.black, quantity: 1 }, { id: GODA.white, quantity: 1 }], total: 7000, saved: 1000 },
    { name: 'HOYGI x1 = $25',           items: [{ id: HOYGI.id, quantity: 1 }], total: 2500, saved: 0 },
    { name: 'HOYGI x2 = $44 (save $6)', items: [{ id: HOYGI.id, quantity: 2 }], total: 4400, saved: 600, title: 'HOYGI · Buy 2 · Save $6' },
    { name: 'HOYGI x3 = $63 (save $12)', items: [{ id: HOYGI.id, quantity: 3 }], total: 6300, saved: 1200, title: 'HOYGI · Buy 3 · Save $12' },
    { name: 'The Pair: GODA + HOYGI = $59 (save $6)', items: [{ id: GODA.black, quantity: 1 }, { id: HOYGI.id, quantity: 1 }], total: 5900, saved: 600, title: 'The ZOREV Pair · Save $6' },
    { name: 'GODA x2 + HOYGI x1 = $89 (tier + pair stack)', items: [{ id: GODA.black, quantity: 2 }, { id: HOYGI.id, quantity: 1 }], total: 8900, saved: 1600 },
    { name: 'GODA x1 + HOYGI x2 = $78 (pair + HOYGI tier)', items: [{ id: GODA.black, quantity: 1 }, { id: HOYGI.id, quantity: 2 }], total: 7800, saved: 1200 },
  ];

  for (const c of cases) {
    test(c.name, async ({ page }) => {
      await addItems(page, c.items);
      const j = await cart(page);
      expect(j.total_price, 'total_price').toBe(c.total);
      expect(j.total_discount, 'total_discount').toBe(c.saved);
      if (c.title) expect(discountTitles(j)).toContain(c.title);
    });
  }
});
