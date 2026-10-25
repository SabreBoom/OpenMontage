/* ZOREV — small, dependency-free.
   Variant picking, the one Ajax add-to-cart owner, the cart drawer with
   Shopify's own savings, and the pair rule shared by every pair surface.
   The PDP gallery lives in main-product.liquid: it is a scroll-snap track
   owned by that section, not a src-swapper driven from here.

   Public hooks:
     window.ZorevCart   { show(opener?), close, fetch, setCount(n), say(msg),
                          isOpen(), media(variantId), label(title) }
                        show(opener) remembers the control that opened the
                        drawer; close() gives focus back to it.
     window.ZorevPair   { applies(g, h) }  g = GODA units, h = HOYGI units in
                        the bag AFTER an add. Inferred from Shopify's measured
                        results; the drawer/cart always show the real outcome.
     window.ZorevMoney(cents, format)        money formatting
     window.ZorevDiscountsOf(cart)           [{title, amount}] from Shopify
     window.ZorevLabel(variantTitle)         "Citrus 15ml Men" -> "Citrus (men's)"
   Events:
     document 'cart:painted'   after every repaint, detail = /cart.js
     document 'cart:updated'   listened to: anything that changed the cart
                               outside this file fires it, the drawer refetches
     document 'variant:change' {id, index, price, available, initial}; the
                               first one on load is the server's own selection
                               (initial: true) and must not animate
     form 'atc:done'           (bubbles) after an add finished, either way
   Anything that needs to react to the real cart listens for 'cart:painted'
   instead of fetching /cart.js again on its own. */
(function () {
  'use strict';

  var RM = window.matchMedia('(prefers-reduced-motion: reduce)');

  // --- Money -------------------------------------------------------------
  function group(str, sep) {
    return str.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }

  // A money_format can carry HTML entities — &euro;, &pound;. These prices are
  // written with textContent, which would print the entity literally.
  function decodeEntities(s) {
    if (!s || s.indexOf('&') === -1) return s;
    var t = document.createElement('textarea');
    t.innerHTML = s;
    return t.value;
  }

  function money(cents, fmt) {
    fmt = fmt || '${{amount}}';
    var n = Math.round(Number(cents) || 0);
    var neg = n < 0;
    n = Math.abs(n);

    var out = fmt.replace(/\{\{\s*(\w+)\s*\}\}/, function (_, name) {
      var whole = String(Math.floor(n / 100));
      var frac = ('0' + (n % 100)).slice(-2);
      switch (name) {
        case 'amount_no_decimals': return group(whole, ',');
        case 'amount_with_comma_separator': return group(whole, '.') + ',' + frac;
        case 'amount_no_decimals_with_comma_separator': return group(whole, '.');
        case 'amount_with_apostrophe_separator': return group(whole, "'") + '.' + frac;
        default: return group(whole, ',') + '.' + frac;
      }
    });
    return neg ? '-' + out : out;
  }
  window.ZorevMoney = money;

  // --- The pair rule -----------------------------------------------------
  /* One definition for every surface (drawer, cart page, product page, pair
     band). Shopify applies the pair saving once per order iff the bag, after
     the add, holds at least one GODA and one HOYGI, and either no more than
     two HOYGI or at least as many GODA as HOYGI. Measured: 1G1H, 2G1H, 1G2H,
     2G2H, 3G1H, 3G3H, 4G2H apply; 1G3H, 2G3H, 1G4H do not. It is inferred,
     so copy built on it stays modest and the bag shows Shopify's result. */
  window.ZorevPair = {
    applies: function (g, h) {
      g = Number(g) || 0; h = Number(h) || 0;
      return g >= 1 && h >= 1 && (h <= 2 || g >= h);
    }
  };

  // --- Variant labels ----------------------------------------------------
  /* The one place JS turns an option value into the name customers see on
     the product page: "Black 15ml" -> "Black", "Citrus 15ml Men" ->
     "Citrus (men's)". Mirrors snippets/zvlabel.liquid. A size-only value
     ("9g") names nothing a customer chose, so it is not shown. */
  function variantLabel(t) {
    t = String(t == null ? '' : t);
    if (!t || t === 'Default Title') return '';
    var out = t.split(' 15ml').join('').split('15ml ').join('').split(' 15 ml').join('');
    out = out.split(' Men').join(' (men’s)').split(' Women').join(' (women’s)').replace(/^\s+|\s+$/g, '');
    if (!out) out = t;
    if (/^\d+([.,]\d+)?\s?(ml|g|oz)$/i.test(out)) return '';
    return out;
  }
  window.ZorevLabel = variantLabel;

  // --- Product pictures and labels for script-painted lines --------------
  /* snippets/cutout-data renders one small JSON per page:
       { "studio": bool, "v": { "<variant id>": { p, src, studio, label } } }
     src is the variant's studio packshot at 240w when Theme settings >
     Studio images is on and a slot names that variant, else the variant's
     own photograph (or the product's). label is snippets/zvlabel's output,
     empty for a single-variant product. Read once, lazily. */
  var mediaMap = null;
  function media(vid) {
    if (mediaMap === null) {
      mediaMap = {};
      var el = document.querySelector('[data-cutout-map]');
      try {
        var j = el ? JSON.parse(el.textContent) : null;
        mediaMap = (j && j.v) || {};
      } catch (e) { mediaMap = {}; }
    }
    var x = mediaMap[String(vid)];
    if (!x) return null;
    return { src: x.src || null, studio: !!x.studio, label: decodeEntities(x.label || '') };
  }

  // --- Variant picker ----------------------------------------------------
  /* Plural throughout: the PDP has two add-to-cart forms (inline + sticky).
     Options may be buttons (role=radio, aria-checked) or native radio inputs
     (main-product renders radios); both carry data-variant-id. Buttons report
     with click, radios with change (arrow keys fire change, not always
     click); both are listened to and a repeat of the current id is dropped,
     so one choice is one 'variant:change'. */
  function initVariants(scope) {
    var roots = (scope || document).querySelectorAll('[data-variants]');
    Array.prototype.forEach.call(roots, function (root) {
      if (root.__zvVariants) return;
      var data;
      try { data = JSON.parse(root.querySelector('[data-variant-json]').textContent); }
      catch (e) { return; }
      if (!Array.isArray(data) || !data.length) return;
      root.__zvVariants = true;

      var fmt = decodeEntities(root.dataset.moneyFormat);
      var current = null;

      function find(id) {
        return data.filter(function (v) { return String(v.id) === String(id); })[0];
      }

      function select(v, initial) {
        if (!v) return;
        var id = String(v.id);
        if (!initial && id === current) return;
        current = id;
        root.querySelectorAll('[name="id"]').forEach(function (i) { i.value = v.id; });
        root.querySelectorAll('[data-price]').forEach(function (p) { p.textContent = money(v.price, fmt); });
        root.querySelectorAll('[data-add]').forEach(function (b) {
          // Mid-add the button belongs to the add: re-enabling or relabelling
          // it here would allow a second submit of the same intent.
          if (b.getAttribute('aria-busy') === 'true') return;
          b.disabled = !v.available;
          b.textContent = v.available ? 'Add to bag' : 'Sold out';
        });
        root.querySelectorAll('[data-variant-id]').forEach(function (o) {
          var on = o.getAttribute('data-variant-id') === id;
          if (o.type === 'radio') { if (on && !o.checked) o.checked = true; }
          else o.setAttribute('aria-checked', String(on));
        });
        // The quantity offer re-labels the buttons with a total, so it listens
        // for this and repaints after the plain label above has been written.
        document.dispatchEvent(new CustomEvent('variant:change', {
          detail: { id: v.id, index: v.index, price: v.price, available: v.available, initial: !!initial }
        }));
      }

      function fromEvent(e) {
        var el = e.target && e.target.closest ? e.target.closest('[data-variant-id]') : null;
        if (!el || !root.contains(el)) return;
        if (el.type === 'radio' && !el.checked) return;
        select(find(el.getAttribute('data-variant-id')), false);
      }
      root.addEventListener('click', fromEvent);
      root.addEventListener('change', fromEvent);

      // The server's own selection, announced once without motion.
      var first = root.querySelector('[name="id"]');
      var start = String((first && first.value) || data[0].id);
      var hasOption = Array.prototype.some.call(root.querySelectorAll('[data-variant-id]'), function (o) {
        return o.getAttribute('data-variant-id') === start;
      });
      if (hasOption) select(find(start), true);
    });
  }
  initVariants(document);

  // --- Cart drawer -------------------------------------------------------
  var drawer = document.querySelector('[data-cart-drawer]');

  var cart = (function () {
    var body, foot, sub, live, panel, savings, errEl, emptyTpl, fmt;
    var lastFocus = null, open = false, inerted = [], hideTimer = null;
    var seq = 0, busy = false;

    if (drawer) {
      body     = drawer.querySelector('[data-cd-body]');
      foot     = drawer.querySelector('[data-cd-foot]');
      sub      = drawer.querySelector('[data-cd-subtotal]');
      live     = drawer.querySelector('[data-cd-live]');
      panel    = drawer.querySelector('.cd__panel');
      savings  = drawer.querySelector('[data-cd-savings]');
      errEl    = drawer.querySelector('[data-cd-err]');
      emptyTpl = drawer.querySelector('template[data-cd-empty]');
      fmt      = decodeEntities(drawer.dataset.moneyFormat);
    }

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function items(n) { n = Number(n) || 0; return n + (n === 1 ? ' item' : ' items'); }

    /* Every line's picture sits on the studio plate: a maker's packshot from
       Theme settings > Studio images when there is one for the variant, else
       the variant's photograph from the page's map, else the line's own
       Shopify image. */
    function thumb(item) {
      var m = media(item.variant_id);
      var src = m && m.src;
      if (!src) {
        var raw = item.image || (item.featured_image && item.featured_image.url);
        if (raw) src = raw.replace(/(\.(jpg|jpeg|png|webp))(\?|$)/i, '_160x$1$3');
      }
      if (!src) return '<span class="cd__thumb cd__thumb--empty" aria-hidden="true"></span>';
      if (src.indexOf('//') === 0) src = window.location.protocol + src;
      return '<span class="cd__thumb zv-studio" aria-hidden="true"><img src="' + esc(src) +
             '" alt="" loading="lazy" decoding="async" width="72" height="72"></span>';
    }

    function lineLabel(item) {
      var m = media(item.variant_id);
      if (m) return m.label;
      if (item.product_has_only_default_variant) return '';
      return variantLabel(item.variant_title);
    }

    /* The visible badge is a number for the eye; the link's name comes from
       [data-cart-count-text] ("Bag, 2 items"), rendered by the header. */
    function setCount(n) {
      n = Number(n) || 0;
      document.querySelectorAll('[data-cart-count]').forEach(function (el) {
        el.textContent = n;
        el.hidden = n === 0;
        el.setAttribute('aria-hidden', 'true');
      });
      document.querySelectorAll('[data-cart-count-text]').forEach(function (el) {
        el.textContent = items(n);
      });
    }

    /* Every saving the customer sees is one Shopify reported — the titles are
       the discount titles from Discounts, the amounts are Shopify's own
       allocations. Nothing here computes a price. That is the point: the
       drawer can never promise a total the checkout won't charge. */
    function discountsOf(c) {
      var map = {}, order = [];
      function add(title, amount) {
        var t = title || 'Discount';
        if (!(t in map)) { map[t] = 0; order.push(t); }
        map[t] += Number(amount) || 0;
      }
      (c.items || []).forEach(function (i) {
        (i.line_level_discount_allocations || []).forEach(function (a) {
          add(a.discount_application && a.discount_application.title, a.amount);
        });
      });
      (c.cart_level_discount_applications || []).forEach(function (d) {
        add(d.title, d.total_allocated_amount);
      });
      return order.map(function (t) { return { title: t, amount: map[t] }; })
                  .filter(function (d) { return d.amount > 0; });
    }
    window.ZorevDiscountsOf = discountsOf;

    function paintSavings(c) {
      if (!savings) return;
      var list = discountsOf(c);
      var total = Number(c.total_discount) || 0;
      if (!list.length || total <= 0) {
        savings.hidden = true;
        savings.innerHTML = '';
        return;
      }
      savings.hidden = false;
      savings.innerHTML =
        '<ul class="cd__disc" role="list">' +
          list.map(function (d) {
            return '<li><span class="cd__disct">' + esc(d.title) + '</span>' +
                   '<span class="cd__disca">&minus;' + esc(money(d.amount, fmt)) + '</span></li>';
          }).join('') +
        '</ul>' +
        (list.length > 1
          ? '<p class="cd__saved"><span>You save</span><span>' + esc(money(total, fmt)) + '</span></p>'
          : '');
    }

    function announce(c) {
      document.dispatchEvent(new CustomEvent('cart:painted', { detail: c }));
    }

    function showErr(msg) {
      if (!errEl) return;
      errEl.textContent = msg || '';
      errEl.hidden = !msg;
    }

    function paintEmpty() {
      if (emptyTpl && emptyTpl.content) {
        body.innerHTML = '';
        body.appendChild(emptyTpl.content.cloneNode(true));
      } else {
        body.innerHTML =
          '<div class="cd__empty">' +
            '<p class="cd__emptyh" tabindex="-1" data-cd-empty-focus>Your bag is empty.</p>' +
            '<div class="cd__emptyact"><a class="btn" href="/collections/all">Shop ZOREV</a></div>' +
          '</div>';
      }
    }

    function stepBtn(line, to, dir, label, glyph) {
      return '<button type="button" class="cd__step" data-cd-qty="' + line + '" data-cd-to="' + to +
             '" data-cd-dir="' + dir + '" aria-label="' + label + '">' + glyph + '</button>';
    }

    function paint(c) {
      setCount(c.item_count);
      if (!drawer || !body) { announce(c); return; }
      showErr('');

      if (!c.items || !c.items.length) {
        paintEmpty();
        foot.hidden = true;
        paintSavings(c);
        announce(c);
        return;
      }

      body.innerHTML = '<ul class="cd__lines" role="list">' + c.items.map(function (i, idx) {
        var line = idx + 1;
        var lab = lineLabel(i);
        var name = i.product_title + (lab ? ', ' + lab : '');

        // original_line_price vs final_line_price is how Shopify reports a
        // line-level discount. Fall back to line_price when final is absent.
        var was = Number(i.original_line_price) || 0;
        var now = (i.final_line_price != null) ? Number(i.final_line_price)
                                              : Number(i.line_price) || 0;
        var priceBlock = (was > now)
          ? '<s class="fine"><span class="visually-hidden">Regular price </span>' + esc(money(was, fmt)) + '</s>' +
            '<span class="cd__lp">' + esc(money(now, fmt)) + '</span>'
          : '<span class="cd__lp">' + esc(money(now, fmt)) + '</span>';

        return '' +
          '<li class="cd__line" data-cd-key="' + esc(i.key) + '" data-cd-line="' + line + '">' +
            thumb(i) +
            '<div class="cd__lineinfo">' +
              '<a class="cd__name" href="' + esc(i.url) + '">' + esc(i.product_title) + '</a>' +
              (lab ? '<p class="cd__var fine">' + esc(lab) + '</p>' : '') +
              '<div class="cd__qty" role="group" aria-label="Quantity for ' + esc(name) + '">' +
                stepBtn(line, i.quantity - 1, 'dec', 'Decrease quantity', '−') +
                '<span class="cd__n">' + i.quantity + '</span>' +
                stepBtn(line, i.quantity + 1, 'inc', 'Increase quantity', '+') +
              '</div>' +
            '</div>' +
            '<div class="cd__lineend">' + priceBlock +
              '<button type="button" class="cd__rm fine" data-cd-qty="' + line + '" data-cd-to="0" ' +
                'data-cd-dir="rm" aria-label="Remove ' + esc(name) + '">Remove</button>' +
            '</div>' +
          '</li>';
      }).join('') + '</ul>';

      paintSavings(c);

      var saved = Number(c.total_discount) || 0;
      var orig = Number(c.original_total_price) || 0;
      if (saved > 0 && orig > c.total_price) {
        sub.innerHTML = '<s class="fine"><span class="visually-hidden">Regular price </span>' +
                        esc(money(orig, fmt)) + '</s> ' + esc(money(c.total_price, fmt));
      } else {
        sub.textContent = money(c.total_price, fmt);
      }
      foot.hidden = false;
      announce(c);
    }

    function fetchCart() {
      var my = ++seq;
      return fetch('/cart.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
        .then(function (c) { if (my === seq) paint(c); return c; })
        .catch(function () {
          if (!body) return;
          if (body.querySelector('.cd__line')) { showErr('Your bag could not be refreshed. Please try again.'); return; }
          body.innerHTML = '<p class="cd__loading fine">Your bag could not be loaded. ' +
            '<a href="/cart">Open the cart page</a>.</p>';
        });
    }

    // --- focus: trap, inert page, return ---------------------------------
    var SEL = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),' +
              'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    function usable(el) {
      return !!el && el.isConnected !== false && document.documentElement.contains(el) &&
             !el.disabled && !el.closest('[hidden],[inert],[aria-hidden="true"]') &&
             el.getClientRects().length > 0;
    }

    function focusables() {
      if (!panel) return [];
      return Array.prototype.filter.call(panel.querySelectorAll(SEL), usable);
    }

    function focusEl(el) {
      if (!el || !el.focus) return;
      try { el.focus({ preventScroll: true }); } catch (x) { el.focus(); }
    }

    /* Everything outside the drawer is inert while it is open, so neither
       Tab, a screen reader's virtual cursor nor a stray click reaches the
       page behind the scrim. Siblings are marked on every level from the
       drawer up to <body>; only what this script marked is unmarked. */
    function setInert(on) {
      if (!on) {
        inerted.forEach(function (el) { el.removeAttribute('inert'); });
        inerted = [];
        return;
      }
      inerted = [];
      var node = drawer;
      while (node && node !== document.body && node.parentElement) {
        var parent = node.parentElement;
        Array.prototype.forEach.call(parent.children, function (sib) {
          if (sib === node || /^(SCRIPT|STYLE|TEMPLATE|LINK|META|NOSCRIPT)$/.test(sib.tagName)) return;
          if (sib.hasAttribute('inert')) return;
          sib.setAttribute('inert', '');
          inerted.push(sib);
        });
        node = parent;
      }
    }

    /* The wrap is decided from where focus is, not only from the first and
       last stops: right after opening, focus is on the panel itself, and a
       Shift+Tab from there must land on the last control, not behind. */
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Esc') { close(); return; }
      if (e.key !== 'Tab' || !panel) return;
      var f = focusables();
      if (!f.length) { e.preventDefault(); focusEl(panel); return; }
      var first = f[0], last = f[f.length - 1], a = document.activeElement;
      var inside = !!a && panel.contains(a);
      if (e.shiftKey) {
        if (!inside || a === panel || a === first) { e.preventDefault(); focusEl(last); }
      } else if (!inside || a === last) {
        e.preventDefault(); focusEl(first);
      }
    }

    function onFocusIn(e) {
      if (open && panel && drawer && !drawer.contains(e.target)) focusEl(panel);
    }

    function show(opener) {
      if (!drawer || open) return;
      open = true;
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      var a = document.activeElement;
      lastFocus = (opener && opener.nodeType === 1) ? opener
                : (a && a !== document.body && !drawer.contains(a) ? a : null);
      drawer.hidden = false;
      drawer.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(function () { drawer.classList.add('is-open'); });
      document.documentElement.classList.add('cd-locked');
      setInert(true);
      document.addEventListener('keydown', onKey);
      document.addEventListener('focusin', onFocusIn);
      focusEl(panel);
    }

    function returnTarget() {
      if (usable(lastFocus)) return lastFocus;
      var links = document.querySelectorAll('[data-cart-link]');
      for (var i = 0; i < links.length; i++) { if (usable(links[i])) return links[i]; }
      return null;
    }

    function close() {
      if (!drawer || !open) return;
      open = false;
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('cd-locked');
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      setInert(false);
      var done = function () { hideTimer = null; if (!open) drawer.hidden = true; };
      if (RM.matches) done(); else hideTimer = setTimeout(done, 380);
      var t = returnTarget();
      lastFocus = null;
      if (t) focusEl(t);
    }

    // --- quantity changes --------------------------------------------------
    /* After a repaint the pressed control no longer exists. Focus goes back
       to the same control of the same line (found by the line's key, then by
       its position); after a removal, to the line that took its place (its
       name, never another Remove), and in an empty bag to the message. */
    function refocus(want) {
      if (!open || !body || !want) return;
      var rows = Array.prototype.slice.call(body.querySelectorAll('.cd__line'));
      var target = null;
      if (!rows.length) {
        target = body.querySelector('[data-cd-empty-focus]');
      } else if (want.dir !== 'rm' && want.to > 0) {
        var same = rows.filter(function (r) { return want.key && r.getAttribute('data-cd-key') === want.key; });
        var row = same.filter(function (r) { return r.getAttribute('data-cd-line') === String(want.line); })[0] ||
                  same[0] || rows[Math.min(want.line, rows.length) - 1];
        target = row && (row.querySelector('[data-cd-dir="' + want.dir + '"]') || row.querySelector('.cd__name'));
      } else {
        var next = rows[Math.min(want.line, rows.length) - 1];
        target = next && next.querySelector('.cd__name');
      }
      focusEl(target || panel);
    }

    function change(line, qty, ctl) {
      if (busy) return Promise.resolve();
      busy = true;
      line = Number(line); qty = Math.max(0, Number(qty) || 0);
      var row = ctl && ctl.closest ? ctl.closest('.cd__line') : null;
      var nameEl = row ? row.querySelector('.cd__name') : null;
      var want = {
        line: line, to: qty,
        dir: ctl ? ctl.getAttribute('data-cd-dir') : null,
        key: row ? row.getAttribute('data-cd-key') : null
      };
      var title = nameEl ? nameEl.textContent : 'Item';
      if (body) body.setAttribute('aria-busy', 'true');
      var my = ++seq;
      return fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ line: line, quantity: qty })
      })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
        .then(function (c) {
          if (my === seq) paint(c);
          say(qty === 0
            ? title + ' removed. ' + items(c.item_count) + ' in your bag.'
            : title + ', quantity ' + qty + '. ' + items(c.item_count) + ' in your bag.');
          refocus(want);
        })
        .catch(function () {
          return fetchCart().then(function () {
            showErr('That change did not go through. Please try again.');
            say('That change did not go through. Please try again.');
            refocus(want);
          });
        })
        .then(function () { busy = false; if (body) body.removeAttribute('aria-busy'); });
    }

    function say(msg) {
      if (!live) return;
      // Cleared first so the same sentence twice is still announced twice.
      live.textContent = '';
      setTimeout(function () { live.textContent = msg; }, 30);
    }

    if (drawer) {
      drawer.addEventListener('click', function (e) {
        if (e.target.closest('[data-cd-close]')) { e.preventDefault(); close(); return; }
        var q = e.target.closest('[data-cd-qty]');
        if (q) {
          if (busy) return;
          change(q.getAttribute('data-cd-qty'), q.getAttribute('data-cd-to'), q);
          return;
        }
        // A link to a place on this same page (the empty bag's "#pair") has
        // to close the drawer, or it would scroll the page behind it.
        var a = e.target.closest('a[href]');
        if (a && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
          try {
            var u = new URL(a.href, window.location.href);
            if (u.hash && u.pathname === window.location.pathname) close();
          } catch (x) {}
        }
      });
    }

    return { show: show, close: close, fetch: fetchCart, setCount: setCount, say: say,
             isOpen: function () { return open; }, media: media, label: variantLabel };
  })();

  window.ZorevCart = cart;

  // Header cart link opens the drawer; it stays a real link for no-JS.
  document.addEventListener('click', function (e) {
    if (!drawer) return;
    var a = e.target.closest('a[href]');
    if (!a) return;
    // The drawer's own "View full bag" link must navigate, not re-open the
    // drawer it already sits inside.
    if (drawer.contains(a)) return;
    // On the cart page itself the drawer would be a second copy of the page.
    if (/\/cart\/?$/.test(window.location.pathname)) return;
    var path;
    try { path = new URL(a.href, window.location.origin).pathname; } catch (err) { return; }
    if (!/\/cart\/?$/.test(path)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    cart.show(a);
    cart.fetch();
  });

  /* Ajax add-to-cart, falling back to a normal post so a network blip never
     swallows the purchase intent. This is the only add-to-cart owner for
     product forms. A form marked data-no-ajax is left alone, and so is the
     cart page's pair form (data-cart-pair-form): that section posts it
     itself and re-renders in place, and two owners would add it twice.

     While adding, the button is aria-busy/aria-disabled rather than
     disabled: a focused button that becomes disabled drops focus to <body>,
     and the drawer could then not hand focus back to it on close.

     A 422 is not a network blip — it is Shopify refusing the add, usually on
     stock — so its message is shown next to the button rather than bouncing
     the customer to a bare error page. */
  function initAtc(scope) {
    var forms = (scope || document).querySelectorAll(
      'form[action*="/cart/add"]:not([data-no-ajax]):not([data-cart-pair-form])');
    Array.prototype.forEach.call(forms, function (form) {
      if (form.__zvAtc) return;
      form.__zvAtc = true;
      form.addEventListener('submit', function (e) {
        if (!drawer || !window.fetch) return;
        e.preventDefault();
        if (form.__zvBusy) return;
        form.__zvBusy = true;
        var btn = form.querySelector('[data-add], [type="submit"]');
        var err = form.querySelector('[data-atc-error]');
        var label = btn ? btn.textContent : '';
        if (btn) {
          btn.setAttribute('aria-busy', 'true');
          btn.setAttribute('aria-disabled', 'true');
          btn.textContent = 'Adding…';
        }
        if (err) { err.hidden = true; err.textContent = ''; }

        /* A product page with mixed options (one Black, one White) writes the
           lines it wants to data-items; those go up as JSON line items. */
        var lines = null;
        try { lines = JSON.parse(form.getAttribute('data-items') || 'null'); } catch (x) { lines = null; }
        if (!Array.isArray(lines) || !lines.length) lines = null;

        fetch('/cart/add.js', {
          method: 'POST',
          headers: lines ? { Accept: 'application/json', 'Content-Type': 'application/json' } : { Accept: 'application/json' },
          body: lines ? JSON.stringify({ items: lines }) : new FormData(form)
        })
          .then(function (r) {
            if (r.status === 422) {
              return r.json().catch(function () { return null; }).then(function (j) {
                var e2 = new Error((j && (j.description || j.message)) || 'That could not be added.');
                e2.refused = true; throw e2;
              });
            }
            return r.ok ? r.json() : Promise.reject(r);
          })
          .then(function () {
            // A short tick on devices that support it. Guarded because iOS
            // Safari does not implement vibrate and older Androids throw.
            try { if (navigator.vibrate && !RM.matches) navigator.vibrate(10); } catch (x) {}
            cart.show(btn);
            return cart.fetch();
          })
          .catch(function (x) {
            if (x && x.refused && err) { err.textContent = x.message; err.hidden = false; return; }
            /* A plain post can only carry one option, so for a mix it would
               add the wrong ones: ask for a retry instead. */
            if (lines) {
              if (err) { err.textContent = 'That could not be added. Please try again.'; err.hidden = false; }
              return;
            }
            form.submit();
          })
          .then(function () {
            form.__zvBusy = false;
            if (btn) {
              btn.removeAttribute('aria-busy');
              btn.removeAttribute('aria-disabled');
              btn.textContent = label;
            }
            form.dispatchEvent(new CustomEvent('atc:done', { bubbles: true }));
          });
      });
    });
  }
  initAtc(document);

  // The theme editor re-renders a section without reloading the page.
  document.addEventListener('shopify:section:load', function (e) {
    initVariants(e.target);
    initAtc(e.target);
  });

  cart.fetch();
  document.addEventListener('cart:updated', function () { cart.fetch(); });
})();
