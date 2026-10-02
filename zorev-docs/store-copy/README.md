# Store copy: what changed outside the theme, and how to undo it

`original/` is each text exactly as it was in Shopify on 2026-10-02, kept so
any change can be pasted back. `new/` is what replaced it.

## Already applied in Shopify (Admin API)

| Where in admin | File |
| --- | --- |
| Online Store > Pages > About us, Contact, FAQ, Shipping, Track order | `page-*.html` |
| Products > GODA, HOYGI (description) | `product-*.html` |
| Products > Collections > The Pair (description) | `collection-the-pair.html` |

Store facts not known here were left alone rather than guessed: a business
address, scent notes, and whether orders really ship within one business day.

## Not applied: needs the owner (Settings > Policies)

The connection used here has no permission to edit policies, so these are
paste-ready. In Shopify admin open **Settings > Policies**, open the policy,
switch the editor to HTML (`<>`), replace everything with the file's
contents, and save.

- **Refund policy** (`new/policy-refund_policy.html`). The current policy
  contradicts itself: it offers 30-day returns, then lists personal care
  goods, which is everything ZOREV sells, as non-returnable. The new text
  follows the store's own exception: no change-of-mind returns; damaged,
  defective or wrong items are put right; the EU 14-day cooling-off right
  stays (that one is the law); refund timing is unchanged. **This is a
  business choice.** If you would rather keep 30-day returns, keep the
  original and delete "personal care goods" from its non-returnable list
  instead.
- **Terms of service** (`new/policy-terms_of_service.html`). The current
  text holds the whole template three times over (74 KB). The new file is
  the cleanest single copy, with its `[LINK]` placeholder replaced by a link
  to the privacy policy. Its contact section has the email only; add a
  business address if you have one.
