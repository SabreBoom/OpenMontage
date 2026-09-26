/* ZOREV — small, dependency-free.
   Variant picking, Ajax cart drawer with savings, sticky add-to-cart bar.
   The PDP gallery lives in main-product.liquid now: it is a scroll-snap
   track owned by that section, not a src-swapper driven from here.

   Two public hooks, used by the pair offer and the quantity selector:
     window.ZorevCart         { show, close, fetch, setCount }
     document 'cart:painted'  fired after every repaint, detail = /cart.js
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

  // --- Variant picker ----------------------------------------------------
  // Plural throughout: the PDP has two add-to-cart forms (inline + sticky).
  document.querySelectorAll('[data-variants]').forEach(function (root) {
    var data;
    try { data = JSON.parse(root.querySelector('[data-variant-json]').textContent); }
    catch (e) { return; }

    var idInputs = root.querySelectorAll('[name="id"]');
    var priceEls = root.querySelectorAll('[data-price]');
    var btns     = root.querySelectorAll('[data-add]');
    var fmt      = decodeEntities(root.dataset.moneyFormat);

    function select(v, el) {
      if (!v) return;
      idInputs.forEach(function (i) { i.value = v.id; });
      priceEls.forEach(function (p) { p.textContent = money(v.price, fmt); });
      btns.forEach(function (b) {
        b.disabled = !v.available;
        b.textContent = v.available ? 'Add to bag' : 'Sold out';
      });
      root.querySelectorAll('[data-variant-id]').forEach(function (o) {
        o.setAttribute('aria-checked', String(o === el));
      });
      // The quantity offer re-labels the buttons with a total, so it listens
      // for this and repaints after the plain label above has been written.
      document.dispatchEvent(new CustomEvent('variant:change',
        { detail: { id: v.id, index: v.index, price: v.price, available: v.available } }));
    }

    root.querySelectorAll('[data-variant-id]').forEach(function (el, i) {
      el.addEventListener('click', function () {
        select(data.filter(function (v) { return String(v.id) === el.dataset.variantId; })[0], el);
      });
      if (i === 0) select(data[0], el);
    });
  });

  // --- Cart drawer -------------------------------------------------------
  var drawer = document.querySelector('[data-cart-drawer]');

  var cart = (function () {
    var body, foot, sub, live, panel, savings, fmt, lastFocus = null, open = false;

    if (drawer) {
      body    = drawer.querySelector('[data-cd-body]');
      foot    = drawer.querySelector('[data-cd-foot]');
      sub     = drawer.querySelector('[data-cd-subtotal]');
      live    = drawer.querySelector('[data-cd-live]');
      panel   = drawer.querySelector('.cd__panel');
      savings = drawer.querySelector('[data-cd-savings]');
      fmt     = decodeEntities(drawer.dataset.moneyFormat);
    }

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    /* The clean cutouts, when the page carries them (snippets/cutout-data):
       product id -> variant id -> 160px image. Read once, lazily. */
    var cutMap = null;
    function cutoutFor(item) {
      if (cutMap === null) {
        cutMap = {};
        var el = document.querySelector('[data-cutout-map]');
        try { cutMap = el ? (JSON.parse(el.textContent) || {}) : {}; } catch (e) { cutMap = {}; }
      }
      var byVariant = cutMap[String(item.product_id)];
      return byVariant ? byVariant[String(item.variant_id)] : null;
    }

    function thumb(item) {
      var cut = cutoutFor(item);
      if (cut) {
        return '<span class="cd__thumb cd__thumb--stage"><img src="' + esc(cut) + '" alt="" loading="lazy" width="72" height="72"></span>';
      }
      var src = item.image || (item.featured_image && item.featured_image.url);
      if (!src) return '<div class="cd__thumb cd__thumb--empty" aria-hidden="true"></div>';
      var url = src.indexOf('//') === 0 ? window.location.protocol + src : src;
      url = url.replace(/(\.(jpg|jpeg|png|webp))/i, '_160x$1');
      return '<img class="cd__thumb" src="' + esc(url) + '" alt="" loading="lazy" width="72" height="72">';
    }

    function setCount(n) {
      document.querySelectorAll('[data-cart-count]').forEach(function (el) {
        el.textContent = n;
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

    function paint(c) {
      setCount(c.item_count);
      if (!drawer) { announce(c); return; }

      if (!c.items.length) {
        body.innerHTML =
          '<div class="cd__empty">' +
            '<p>Your bag is empty.</p>' +
            '<a class="btn btn--ghost" href="/collections/all">Browse the collection</a>' +
          '</div>';
        foot.hidden = true;
        paintSavings(c);
        announce(c);
        return;
      }

      body.innerHTML = c.items.map(function (i, idx) {
        var line = idx + 1;
        var variant = (i.variant_title && i.variant_title !== 'Default Title')
          ? '<p class="cd__var fine">' + esc(i.variant_title) + '</p>' : '';

        // original_line_price vs final_line_price is how Shopify reports a
        // line-level discount. Fall back to line_price when final is absent.
        var was = Number(i.original_line_price) || 0;
        var now = (i.final_line_price != null) ? Number(i.final_line_price)
                                              : Number(i.line_price) || 0;
        var priceBlock = (was > now)
          ? '<s class="fine">' + esc(money(was, fmt)) + '</s>' +
            '<span class="cd__lp">' + esc(money(now, fmt)) + '</span>'
          : '<span class="cd__lp">' + esc(money(now, fmt)) + '</span>';

        return '' +
          '<article class="cd__line">' +
            thumb(i) +
            '<div class="cd__lineinfo">' +
              '<a class="cd__name" href="' + esc(i.url) + '">' + esc(i.product_title) + '</a>' +
              variant +
              '<div class="cd__qty" role="group" aria-label="Quantity for ' + esc(i.product_title) + '">' +
                '<button type="button" class="cd__step" data-cd-qty="' + line + '" ' +
                  'data-cd-to="' + (i.quantity - 1) + '" aria-label="Decrease quantity">−</button>' +
                '<span class="cd__n">' + i.quantity + '</span>' +
                '<button type="button" class="cd__step" data-cd-qty="' + line + '" ' +
                  'data-cd-to="' + (i.quantity + 1) + '" aria-label="Increase quantity">+</button>' +
              '</div>' +
            '</div>' +
            '<div class="cd__lineend">' + priceBlock +
              '<button type="button" class="cd__rm fine" data-cd-qty="' + line + '" data-cd-to="0">Remove</button>' +
            '</div>' +
          '</article>';
      }).join('');

      paintSavings(c);

      var saved = Number(c.total_discount) || 0;
      var orig = Number(c.original_total_price) || 0;
      if (saved > 0 && orig > c.total_price) {
        sub.innerHTML = '<s class="fine">' + esc(money(orig, fmt)) + '</s> ' +
                        esc(money(c.total_price, fmt));
      } else {
        sub.textContent = money(c.total_price, fmt);
      }
      foot.hidden = false;
      announce(c);
    }

    function fetchCart() {
      return fetch('/cart.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
        .then(function (c) { paint(c); return c; })
        .catch(function () {
          if (body) body.innerHTML = '<p class="fine">Your bag could not be loaded. ' +
            '<a href="/cart">Open the cart page</a>.</p>';
        });
    }

    var SEL = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab' || !panel) return;
      var f = Array.prototype.filter.call(panel.querySelectorAll(SEL), function (el) {
        return el.offsetParent !== null;
      });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function show() {
      if (!drawer || open) return;
      open = true;
      lastFocus = document.activeElement;
      drawer.hidden = false;
      drawer.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(function () { drawer.classList.add('is-open'); });
      document.documentElement.classList.add('cd-locked');
      document.addEventListener('keydown', onKey);
      if (panel) panel.focus();
    }

    function close() {
      if (!drawer || !open) return;
      open = false;
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('cd-locked');
      document.removeEventListener('keydown', onKey);
      var done = function () { drawer.hidden = true; };
      if (RM.matches) done(); else setTimeout(done, 380);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function change(line, qty) {
      if (body) body.setAttribute('aria-busy', 'true');
      return fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ line: Number(line), quantity: Number(qty) })
      })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
        .then(function (c) {
          paint(c);
          if (live) live.textContent = Number(qty) === 0
            ? 'Item removed. ' + c.item_count + ' in bag.'
            : c.item_count + ' in bag.';
        })
        .catch(function () { return fetchCart(); })
        .then(function () { if (body) body.removeAttribute('aria-busy'); });
    }

    function say(msg) { if (live) live.textContent = msg; }

    if (drawer) {
      drawer.addEventListener('click', function (e) {
        if (e.target.closest('[data-cd-close]')) { e.preventDefault(); close(); return; }
        var q = e.target.closest('[data-cd-qty]');
        if (q) { change(q.dataset.cdQty, q.dataset.cdTo); }
      });
    }

    return { show: show, close: close, fetch: fetchCart, setCount: setCount, say: say,
             isOpen: function () { return open; } };
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
    cart.show();
    cart.fetch();
  });

  /* Ajax add-to-cart, falling back to a normal post so a network blip never
     swallows the purchase intent. A form marked data-no-ajax is left alone:
     the cart page uses that so an add reloads the page it is on instead of
     opening a drawer on top of it.

     A 422 is not a network blip — it is Shopify refusing the add, usually on
     stock — so its message is shown next to the button rather than bouncing
     the customer to a bare error page. */
  document.querySelectorAll('form[action*="/cart/add"]:not([data-no-ajax])').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!drawer || !window.fetch) return;
      e.preventDefault();
      var btn = form.querySelector('[data-add], [type="submit"]');
      var err = form.querySelector('[data-atc-error]');
      var label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Adding…'; }
      if (err) { err.hidden = true; err.textContent = ''; }

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form)
      })
        .then(function (r) {
          if (r.status === 422) {
            return r.json().then(function (j) {
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
          cart.show();
          return cart.fetch();
        })
        .catch(function (x) {
          if (x && x.refused && err) { err.textContent = x.message; err.hidden = false; return; }
          form.submit();
        })
        .then(function () {
          if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = label; }
          form.dispatchEvent(new CustomEvent('atc:done', { bubbles: true }));
        });
    });
  });

  cart.fetch();
  document.addEventListener('cart:updated', cart.fetch);
})();
