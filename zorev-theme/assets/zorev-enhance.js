/* ==========================================================================
   ZOREV — progressive enhancement that zorev.js does not cover.

   1. reveal  The page settles in as it scrolls: [data-zv-reveal] fades and
              rises (zorev-tokens.css hides it only under .zv-js and shows
              it on .is-in). Staggered per batch of elements that enter
              together (60ms steps, at most 4), never by page position.
   2. depth   Scroll parallax for [data-zv-scene] layers ([data-zv-depth]).
              Transform-only, one rAF while a scene is on screen. Pointer
              drift and card tilt are retired: data-zv-scene-pointer and
              data-zv-tilt are accepted and ignored.
   3. film    video[data-zv-video] plays only while on screen, never under
              reduced motion, Save-Data or 2G, and always has a pause button.
   4. strip   [data-zv-strip]: a sideways strip with a progress bar and
              optional prev/next and chapter buttons. Native scrolling and
              swiping stay in charge; nothing is hijacked.
   5. rest    [data-zv-rest] gets .zv-resting while off screen, which pauses
              its ambient loops (zorev-film.css).
   6. count   The bag badge shows only when the count is above zero.

   prefers-reduced-motion is watched live: switching it on reveals
   everything, clears every transform this file set and stops films it
   started. Theme editor: a re-rendered section is initialised again.

   Deliberately NOT here: add-to-cart. zorev.js already binds every
   form[action*="/cart/add"], so a second handler would POST twice and add the
   item twice. One owner per cart mutation.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var onReduce = [];
  function whenReduceChanges(fn) { onReduce.push(fn); }
  (function () {
    var fire = function () { onReduce.forEach(function (fn) { fn(reduce.matches); }); };
    if (reduce.addEventListener) { reduce.addEventListener('change', fire); }
    else if (reduce.addListener) { reduce.addListener(fire); }
  })();
  function all(root, sel) {
    var out = [].slice.call(root.querySelectorAll(sel));
    if (root.matches && root.matches(sel)) { out.unshift(root); }
    return out;
  }
  var hasIO = 'IntersectionObserver' in window;

  /* ---- 1. reveal --------------------------------------------------------- */
  var reveal = (function () {
    var STEP = 60, MAX = 3;           /* delays 0, 60, 120, 180ms */
    var io = null;
    /* Tell the stylesheet the reveal is in hand, which switches off the
       two-second fail-safe that would otherwise show everything unanimated. */
    document.documentElement.classList.add('zv-reveal');

    function inDocOrder(a, b) {
      return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    }
    function show(batch) {
      batch = batch.filter(function (el) { return !el.classList.contains('is-in'); }).sort(inDocOrder);
      batch.forEach(function (el, i) {
        var d = reduce.matches ? 0 : Math.min(i, MAX) * STEP;
        if (d) {
          el.style.transitionDelay = d + 'ms';
          /* drop the delay once settled, so later hovers are not delayed */
          setTimeout(function () { el.style.transitionDelay = ''; }, d + 700);
        }
        el.classList.add('is-in');
        if (io) { io.unobserve(el); }
      });
    }
    function showNow(els) {
      els.forEach(function (el) { el.style.transitionDelay = ''; el.classList.add('is-in'); if (io) { io.unobserve(el); } });
    }

    if (hasIO) {
      io = new IntersectionObserver(function (entries) {
        var batch = [];
        entries.forEach(function (e) { if (e.isIntersecting) { batch.push(e.target); } });
        if (batch.length) { show(batch); }
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    }

    function init(root) {
      var items = all(root, '[data-zv-reveal]');
      if (!items.length) { return; }
      /* No IntersectionObserver, or motion is unwelcome: show everything now.
         Never leave content at opacity 0 waiting for a capability. */
      if (!io || reduce.matches) { showNow(items); return; }
      items.forEach(function (el) { if (!el.classList.contains('is-in')) { io.observe(el); } });
      /* Anything already on screen (deep link, restored scroll, the bottom
         8% the margin leaves out) should not wait for a scroll. */
      requestAnimationFrame(function () {
        var vh = window.innerHeight;
        show(items.filter(function (el) {
          var r = el.getBoundingClientRect();
          return r.top < vh && r.bottom > 0;
        }));
      });
    }

    whenReduceChanges(function (on) {
      if (on) { showNow([].slice.call(document.querySelectorAll('[data-zv-reveal]'))); }
    });
    return { init: init, showNow: showNow };
  })();

  /* ---- 2. depth -----------------------------------------------------------
     [data-zv-scene] holds layers marked [data-zv-depth="0..1"]. As the scene
     passes through the viewport the layers shift with it, nearer ones more.
     data-zv-scene-scroll is the fraction of the scene's travel at depth 1
     (negative = the layer lags the page, like a background);
     data-zv-scene-min (px) switches a scene off below that viewport width. */
  var depth = (function () {
    var active = [], scenes = [], raf = null, io = null;

    function clear(sc) { sc.layers.forEach(function (l) { if (l.el.style.transform) { l.el.style.transform = ''; } }); }
    function paint() {
      raf = null;
      if (reduce.matches) { return; }
      var vh = window.innerHeight || 1;
      var vw = window.innerWidth || 0;
      active.forEach(function (sc) {
        if (sc.min && vw < sc.min) { clear(sc); return; }
        var r = sc.el.getBoundingClientRect();
        /* -1 when the scene's centre is a viewport below, +1 a viewport above */
        var t = ((r.top + r.height / 2) - vh / 2) / vh;
        sc.layers.forEach(function (l) {
          var y = t * sc.scroll * r.height * l.d;
          l.el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
        });
      });
    }
    function queue() { if (!raf && active.length) { raf = requestAnimationFrame(paint); } }

    if (hasIO) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var sc = e.target.__zvScene;
          var i = active.indexOf(sc);
          if (e.isIntersecting && i === -1) { active.push(sc); }
          if (!e.isIntersecting && i !== -1) { active.splice(i, 1); }
        });
        queue();
      }, { threshold: 0 });
      window.addEventListener('scroll', queue, { passive: true });
      window.addEventListener('resize', queue, { passive: true });
    }

    function init(root) {
      if (!io) { return; }
      all(root, '[data-zv-scene]').forEach(function (el) {
        if (el.__zvScene) { return; }
        var scroll = parseFloat(el.getAttribute('data-zv-scene-scroll')) || 0;
        if (!scroll) { return; }              /* pointer-only scenes: retired */
        var layers = [].slice.call(el.querySelectorAll('[data-zv-depth]')).map(function (l) {
          return { el: l, d: Math.max(0, Math.min(1, parseFloat(l.getAttribute('data-zv-depth')) || 0)) };
        });
        if (!layers.length) { return; }
        var sc = { el: el, layers: layers, scroll: scroll,
          min: parseFloat(el.getAttribute('data-zv-scene-min')) || 0 };
        el.__zvScene = sc;
        scenes.push(sc);
        io.observe(el);
      });
      queue();
    }

    whenReduceChanges(function (on) {
      if (on) { scenes.forEach(clear); } else { queue(); }
    });
    return { init: init };
  })();

  /* ---- 3. film -------------------------------------------------------------
     video[data-zv-video] (snippets/zv-media) never autoplays from markup.
     One observer plays a clip while at least a third of it is on screen and
     pauses it off screen. Nothing starts by itself under reduced motion,
     Save-Data or a 2G connection: the poster is the picture. The button
     beside each clip is WCAG 2.2.2's "mechanism to pause"; once a visitor
     pauses a clip the observer never starts it again. It stays hidden until
     this script runs, so a visitor without JavaScript never meets a dead
     control. */
  var film = (function () {
    var conn = navigator.connection || {};
    var vids = [];
    function quiet() {
      return reduce.matches || conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');
    }
    function mark(v, playing) {
      var b = v.__zvBtn;
      if (!b) { return; }
      b.setAttribute('data-state', playing ? 'playing' : 'paused');
      b.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
    }
    function start(v) {
      var p = v.play();
      if (p && p.catch) { p.catch(function () { mark(v, false); }); }
    }
    var io = hasIO ? new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        v.__zvSeen = e.isIntersecting;
        if (v.__zvHeld || v.__zvUser) { return; }
        if (e.isIntersecting && !document.hidden && !quiet()) { start(v); }
        else if (!v.paused) { v.pause(); }
      });
    }, { threshold: 0.35 }) : null;

    function init(root) {
      all(root, 'video[data-zv-video]').forEach(function (v) {
        if (v.__zvInit) { return; }
        v.__zvInit = true;
        vids.push(v);
        v.muted = true;   /* belt and braces: autoplay policies require it */
        var frame = v.closest('[data-zv-media]');
        var b = frame ? frame.querySelector('[data-zv-video-toggle]') : null;
        v.__zvBtn = b;
        v.addEventListener('play', function () { mark(v, true); });
        v.addEventListener('pause', function () { mark(v, false); });
        if (b) {
          b.hidden = false;
          mark(v, false);
          b.addEventListener('click', function () {
            if (v.paused) { v.__zvHeld = false; v.__zvUser = quiet(); start(v); }
            else { v.__zvHeld = true; v.__zvUser = false; v.pause(); }
          });
        }
        if (io) { io.observe(v); }
      });
    }

    document.addEventListener('visibilitychange', function () {
      vids.forEach(function (v) {
        if (document.hidden) { if (!v.paused) { v.pause(); } }
        else if (v.__zvSeen && !v.__zvHeld && (v.__zvUser || !quiet())) { start(v); }
      });
    });
    whenReduceChanges(function (on) {
      vids.forEach(function (v) {
        if (on) { if (!v.paused && !v.__zvUser) { v.pause(); } }
        else if (v.__zvSeen && !v.__zvHeld && !quiet()) { start(v); }
      });
    });
    return { init: init };
  })();

  /* ---- 4. strip ------------------------------------------------------------
     Markup contract (all optional except the track):
       [data-zv-strip]                 the root
         [data-zv-strip-track]         the scroller (overflow-x, snap)
           [data-zv-strip-item]        each frame; if none is marked, the
                                       track's children are the items (or,
                                       when the track holds one list, that
                                       list's children)
         [data-zv-strip-bar]           progress bar, scaled on X (aria-hidden)
         [data-zv-strip-controls]      wrapper of the buttons below; render it
                                       with `hidden`, this script shows it
         [data-zv-strip-prev] / [data-zv-strip-next]   <button type="button">
         [data-zv-strip-go="n"]        chapter button; n is the 0-based item
                                       index ({{ forloop.index0 }})
     The script keeps: aria-disabled="true" on prev/next at either end,
     aria-current="true" on the chapter now at the start of the strip,
     data-zv-strip-overflow="true|false" on the root, tabindex="0" on the
     track only while it can scroll, and fires `zv:strip` on the root with
     detail { index } when the current item changes. Smooth scrolling unless
     reduced motion is set; scroll-padding-inline-start is respected. */
  var strip = (function () {
    function init(root) {
      all(root, '[data-zv-strip]').forEach(wire);
    }
    function wire(root) {
      var track = root.querySelector('[data-zv-strip-track]');
      if (!track || root.__zvStrip) { return; }
      root.__zvStrip = true;
      var bar = root.querySelector('[data-zv-strip-bar]');
      var prevs = [].slice.call(root.querySelectorAll('[data-zv-strip-prev]'));
      var nexts = [].slice.call(root.querySelectorAll('[data-zv-strip-next]'));
      var gos = [].slice.call(root.querySelectorAll('[data-zv-strip-go]'));
      [].slice.call(root.querySelectorAll('[data-zv-strip-controls]')).forEach(function (c) { c.hidden = false; });

      var raf = null, current = -1, wanted = null, wantedAt = 0, wantedTime = 0;

      function items() {
        var marked = track.querySelectorAll('[data-zv-strip-item]');
        if (marked.length) { return [].slice.call(marked); }
        var kids = track.children;
        if (kids.length === 1 && kids[0].children.length) { return [].slice.call(kids[0].children); }
        return [].slice.call(kids);
      }
      function pad() {
        var cs = getComputedStyle(track);
        return parseFloat(cs.scrollPaddingInlineStart || cs.scrollPaddingLeft) || 0;
      }
      function maxScroll() { return Math.max(0, track.scrollWidth - track.clientWidth); }
      /* where the strip must scroll to for item `el` to sit at its start */
      function target(el) {
        var left = el.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft - pad();
        return Math.max(0, Math.min(maxScroll(), left));
      }
      function go(i) {
        var list = items();
        if (!list.length) { return; }
        i = Math.max(0, Math.min(list.length - 1, i));
        var left = target(list[i]);
        wanted = i; wantedAt = left; wantedTime = Date.now();
        track.scrollTo({ left: left, behavior: reduce.matches ? 'auto' : 'smooth' });
        queue();
      }
      function step(dir) {
        var list = items(), x = track.scrollLeft, i;
        if (dir > 0) {
          for (i = 0; i < list.length; i++) { if (target(list[i]) > x + 2) { go(i); return; } }
        } else {
          for (i = list.length - 1; i >= 0; i--) { if (target(list[i]) < x - 2) { go(i); return; } }
        }
      }
      function closest() {
        var list = items(), x = track.scrollLeft, best = 0, d = Infinity;
        list.forEach(function (el, i) {
          var dd = Math.abs(target(el) - x);
          if (dd < d - 1) { d = dd; best = i; }
        });
        return best;
      }
      function setDisabled(btns, off) {
        btns.forEach(function (b) {
          if (off) { b.setAttribute('aria-disabled', 'true'); } else { b.removeAttribute('aria-disabled'); }
        });
      }
      function paint() {
        raf = null;
        var max = maxScroll();
        var x = track.scrollLeft;
        /* a region is a tab stop only while there is something to scroll */
        if (max > 1) { track.setAttribute('tabindex', '0'); } else { track.removeAttribute('tabindex'); }
        root.setAttribute('data-zv-strip-overflow', max > 1 ? 'true' : 'false');
        if (bar) {
          var seen = track.clientWidth / Math.max(track.scrollWidth, 1);
          var p = max > 0 ? x / max : 1;
          bar.style.transform = 'scaleX(' + Math.min(1, seen + (1 - seen) * p).toFixed(3) + ')';
        }
        setDisabled(prevs, x <= 2);
        setDisabled(nexts, x >= max - 2);
        if (!gos.length) { return; }
        var now;
        if (wanted !== null && (Math.abs(x - wantedAt) < 4 || Date.now() - wantedTime < 900)) { now = wanted; }
        else { wanted = null; now = closest(); }
        if (now !== current) {
          current = now;
          gos.forEach(function (b) {
            if (parseInt(b.getAttribute('data-zv-strip-go'), 10) === now) { b.setAttribute('aria-current', 'true'); }
            else { b.removeAttribute('aria-current'); }
          });
          root.dispatchEvent(new CustomEvent('zv:strip', { detail: { index: now } }));
        }
      }
      function queue() { if (!raf) { raf = requestAnimationFrame(paint); } }

      prevs.forEach(function (b) { b.addEventListener('click', function () { if (b.getAttribute('aria-disabled') !== 'true') { step(-1); } }); });
      nexts.forEach(function (b) { b.addEventListener('click', function () { if (b.getAttribute('aria-disabled') !== 'true') { step(1); } }); });
      gos.forEach(function (b) {
        b.addEventListener('click', function () { go(parseInt(b.getAttribute('data-zv-strip-go'), 10) || 0); });
      });
      track.addEventListener('scroll', queue, { passive: true });
      window.addEventListener('resize', queue, { passive: true });
      if ('ResizeObserver' in window) { new ResizeObserver(queue).observe(track); }
      paint();
    }
    return { init: init };
  })();

  /* ---- 5. rest -------------------------------------------------------------
     [data-zv-rest] holds slow ambient loops (the hero's breathing plate).
     Once it is off screen there is nothing to see, so its loops are paused
     until it comes back: the page scrolls without paying for a hero nobody
     is looking at. */
  var rest = (function () {
    var io = hasIO ? new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle('zv-resting', !e.isIntersecting); });
    }, { rootMargin: '80px 0px' }) : null;
    function init(root) {
      if (!io) { return; }
      all(root, '[data-zv-rest]').forEach(function (el) {
        if (el.__zvRest) { return; }
        el.__zvRest = true;
        io.observe(el);
      });
    }
    return { init: init };
  })();

  /* ---- 6. bag count ----------------------------------------------------------
     zorev.js owns the count text (cart.setCount writes [data-cart-count] and
     [data-cart-count-text]) but not whether the badge shows, so this watches
     the text it writes and syncs the one attribute it does not set. */
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

    [].slice.call(nodes).forEach(function (el) {
      sync(el);
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    });
  })();

  /* ---- start, and again for a section the theme editor re-renders -------- */
  function initAll(root) {
    reveal.init(root);
    depth.init(root);
    film.init(root);
    strip.init(root);
    rest.init(root);
  }
  initAll(document);
  document.addEventListener('shopify:section:load', function (e) {
    var root = e.target;
    if (!root || !root.querySelectorAll) { return; }
    /* In the editor a re-rendered section shows at once, settled. */
    reveal.showNow(all(root, '[data-zv-reveal]'));
    initAll(root);
  });
})();
