/* ==========================================================================
   ZOREV — progressive enhancement that zorev.js does not cover.

   1. Scroll reveal. zorev-tokens.css hides `.zv-js [data-zv-reveal]` at
      opacity 0 and only shows it again on `.is-in`. NOTHING in the theme was
      adding `.is-in`, so every element marked for reveal was permanently
      invisible — a blank page that still passed a DOM check. This adds the
      observer that class was written for.

   2. Bag count visibility. zorev.js owns the count text (cart.setCount writes
      textContent on [data-cart-count]) but not whether the badge shows, so a
      0 -> 1 change left a hidden badge with "1" in it. Rather than fight
      zorev.js for ownership, this watches the text it writes and syncs the
      one attribute it does not set.

   Deliberately NOT here: add-to-cart. zorev.js already binds every
   form[action*="/cart/add"], so a second handler would POST twice and add the
   item twice. One owner per cart mutation.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- 1. reveal --------------------------------------------------------- */
  (function reveal() {
    var items = document.querySelectorAll('[data-zv-reveal]');
    /* Tell the stylesheet the reveal is in hand, which switches off the
       two-second fail-safe that would otherwise show everything unanimated. */
    document.documentElement.classList.add('zv-reveal');
    if (!items.length) { return; }

    /* No IntersectionObserver, or motion is unwelcome: show everything now.
       Never leave content at opacity 0 waiting for a capability. */
    if (!('IntersectionObserver' in window) || reduce.matches) {
      for (var i = 0; i < items.length; i++) { items[i].classList.add('is-in'); }
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) { return; }
        e.target.classList.add('is-in');
        io.unobserve(e.target);   /* reveal is one-way; stop paying for it */
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });

    items.forEach(function (el, idx) {
      /* a small stagger, capped — a long cascade makes a grid feel slow */
      var step = Math.min(idx, 5) * 55;
      el.style.transitionDelay = step + 'ms';
      io.observe(el);
    });

    /* Anything already past the fold on load (deep link, restored scroll)
       should not sit hidden waiting for a scroll that never comes. */
    requestAnimationFrame(function () {
      items.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) { el.classList.add('is-in'); }
      });
    });
  })();

  /* ---- 3. depth ---------------------------------------------------------
     [data-zv-scene] holds layers marked [data-zv-depth="0..1"]. Two cues,
     both transform-only and both off under reduced motion:
       pointer  on a fine-pointer device the layers drift a few pixels
                against the cursor, the nearer (higher depth) ones more.
       scroll   as the scene passes through the viewport the layers shift
                with it, nearer ones more. This one runs on phones too — it
                costs one rAF while the scene is on screen and nothing else.
     Amounts come from the scene: data-zv-scene-pointer (px at depth 1) and
     data-zv-scene-scroll (fraction of the scene's travel at depth 1). */
  (function depth() {
    var scenes = [].slice.call(document.querySelectorAll('[data-zv-scene]'));
    if (!scenes.length || reduce.matches || !('IntersectionObserver' in window)) { return; }
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var px = 0, py = 0;               /* pointer, -1..1 */
    var active = [];
    var raf = null;

    function paint() {
      raf = null;
      var vh = window.innerHeight || 1;
      active.forEach(function (sc) {
        var r = sc.el.getBoundingClientRect();
        /* -1 when the scene's centre is a viewport below, +1 a viewport above */
        var t = ((r.top + r.height / 2) - vh / 2) / vh;
        sc.layers.forEach(function (l) {
          var x = fine ? -px * sc.pointer * l.d : 0;
          var y = (fine ? -py * sc.pointer * 0.6 * l.d : 0) + t * sc.scroll * r.height * l.d;
          l.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
        });
      });
    }
    function queue() { if (!raf) { raf = requestAnimationFrame(paint); } }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var sc = e.target.__zvScene;
        var i = active.indexOf(sc);
        if (e.isIntersecting && i === -1) { active.push(sc); }
        if (!e.isIntersecting && i !== -1) { active.splice(i, 1); }
      });
      queue();
    }, { threshold: 0 });

    scenes.forEach(function (el) {
      var layers = [].slice.call(el.querySelectorAll('[data-zv-depth]')).map(function (l) {
        return { el: l, d: Math.max(0, Math.min(1, parseFloat(l.getAttribute('data-zv-depth')) || 0)) };
      });
      if (!layers.length) { return; }
      var sc = { el: el, layers: layers,
        pointer: parseFloat(el.getAttribute('data-zv-scene-pointer')) || 0,
        scroll: parseFloat(el.getAttribute('data-zv-scene-scroll')) || 0 };
      el.__zvScene = sc;
      io.observe(el);
    });

    window.addEventListener('scroll', function () { if (active.length) { queue(); } }, { passive: true });
    window.addEventListener('resize', queue, { passive: true });
    if (fine) {
      window.addEventListener('pointermove', function (e) {
        px = (e.clientX / window.innerWidth - 0.5) * 2;
        py = (e.clientY / window.innerHeight - 0.5) * 2;
        if (active.length) { queue(); }
      }, { passive: true });
    }
    queue();
  })();

  /* ---- 4. tilt ----------------------------------------------------------
     [data-zv-tilt] leans toward the pointer by a few degrees, the way a
     card on a desk does when you lean over it. Fine pointers only: a
     finger can't hover. Max lean is data-zv-tilt (degrees, default 4). */
  (function tilt() {
    if (reduce.matches) { return; }
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) { return; }
    [].slice.call(document.querySelectorAll('[data-zv-tilt]')).forEach(function (el) {
      var max = parseFloat(el.getAttribute('data-zv-tilt')) || 4;
      var raf = null, rx = 0, ry = 0, on = false;
      function paint() {
        raf = null;
        el.style.transform = on
          ? 'perspective(1200px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)'
          : '';
      }
      el.addEventListener('pointerenter', function () { on = true; el.classList.add('is-tilting'); });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        ry = x * max * 2; rx = -y * max * 2;
        if (!raf) { raf = requestAnimationFrame(paint); }
      });
      el.addEventListener('pointerleave', function () {
        on = false; el.classList.remove('is-tilting');
        if (!raf) { raf = requestAnimationFrame(paint); }
      });
    });
  })();

  /* ---- 2. bag count ----------------------------------------------------- */
  (function countVisibility() {
    var nodes = document.querySelectorAll('[data-cart-count]');
    if (!nodes.length || !('MutationObserver' in window)) { return; }

    function sync(el) {
      var n = parseInt((el.textContent || '').replace(/\D/g, ''), 10);
      el.hidden = !(n > 0);
    }

    var mo = new MutationObserver(function (records) {
      records.forEach(function (r) {
        var el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
        if (el && el.hasAttribute && el.hasAttribute('data-cart-count')) { sync(el); }
      });
    });

    nodes.forEach(function (el) {
      sync(el);
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    });
  })();
})();