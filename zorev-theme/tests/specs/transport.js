// Store transport for the tests.
//
// The storefront sits behind Cloudflare bot management, which challenges
// headless Chromium and Node HTTP clients on cart writes (HTTP 429,
// "Verifying your connection") and cannot be answered from an environment
// with no route to challenges.cloudflare.com. curl is not challenged. So the
// store's dynamic requests — HTML documents, /cart*.js, section rendering —
// are performed by curl with a per-page cookie jar and handed to the
// browser; static assets under /cdn/ load in the browser as normal.
//
// Only the transport changes. The URL, method, body and cookies are the
// browser's own, the responses come from the real store, and the cart totals
// the tests assert on are what Shopify's discount engine returns.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FORWARD = new Set(['accept', 'accept-language', 'content-type', 'origin', 'referer', 'x-requested-with', 'user-agent']);
// A "HeadlessChrome" user agent is challenged on sight; the browser contexts
// used by the tests set a normal one, and this is the fallback when they do not.
const UA_FALLBACK = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const DROP = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive', 'set-cookie']);
let seq = 0;

function curlFetch(url, { method = 'GET', headers = {}, body = null, jar }) {
  return new Promise((resolve, reject) => {
    const headerFile = path.join(os.tmpdir(), `zv-hdr-${process.pid}-${++seq}.txt`);
    const args = ['-sS', '-L', '--max-redirs', '5', '--max-time', '45', '-D', headerFile, '-o', '-', '-b', jar, '-c', jar, '-H', 'Accept-Encoding: identity'];
    for (const [k, v] of Object.entries(headers)) {
      if (!FORWARD.has(k.toLowerCase())) continue;
      args.push('-H', `${k}: ${k.toLowerCase() === 'user-agent' && /HeadlessChrome/.test(v) ? UA_FALLBACK : v}`);
    }
    // Methods that carry a body always send one, even when it is empty, so
    // the request has a Content-Length (Shopify answers 411 without it).
    const withBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
    if (withBody) args.push('--data-binary', '@-');
    if (method !== 'GET' && method !== 'POST') args.push('-X', method);
    args.push(url);
    const child = execFile('curl', args, { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      let raw = '';
      try { raw = fs.readFileSync(headerFile, 'utf8'); fs.unlinkSync(headerFile); } catch (e) { /* no headers */ }
      if (err && !raw) return reject(err);
      const blocks = raw.split(/\r?\n\r?\n/).filter(b => /^HTTP\//.test(b));
      const lines = (blocks[blocks.length - 1] || 'HTTP/1.1 599 transport').split(/\r?\n/);
      const status = parseInt(lines[0].split(' ')[1], 10) || 599;
      const out = {};
      for (const l of lines.slice(1)) {
        const i = l.indexOf(':');
        if (i <= 0) continue;
        const k = l.slice(0, i).trim().toLowerCase();
        if (DROP.has(k)) continue;
        const v = l.slice(i + 1).trim();
        out[k] = out[k] ? out[k] + ', ' + v : v;
      }
      resolve({ status, headers: out, body: stdout });
    });
    child.stdin.on('error', () => {});
    if (withBody && body != null && body.length) child.stdin.end(body); else child.stdin.end();
  });
}

// Installs the transport on a page for one store host. Returns the jar path.
async function install(page, storeHost, block) {
  const jar = path.join(os.tmpdir(), `zv-jar-${process.pid}-${Date.now()}-${++seq}.txt`);
  page.once('close', () => { try { fs.unlinkSync(jar); } catch (e) { /* already gone */ } });
  await page.route('**/*', async route => {
    const req = route.request();
    const url = req.url();
    if (block && block.test(url)) return route.abort();
    let u;
    try { u = new URL(url); } catch (e) { return route.continue(); }
    if (u.host !== storeHost || u.pathname.startsWith('/cdn/')) return route.continue();
    const started = Date.now();
    try {
      const r = await curlFetch(url, { method: req.method(), headers: req.headers(), body: req.postDataBuffer(), jar });
      if (process.env.ZV_TRANSPORT_DEBUG) process.stderr.write(`[transport] ${r.status} ${req.method()} ${url.slice(0, 90)} ${Date.now() - started}ms ${r.body.length}B ${r.headers['content-type'] || ''}\n`);
      return route.fulfill({ status: r.status, headers: r.headers, body: r.body });
    } catch (e) {
      if (process.env.ZV_TRANSPORT_DEBUG) process.stderr.write(`[transport] FAIL ${req.method()} ${url.slice(0, 90)} ${String(e).slice(0, 120)}\n`);
      return route.abort();
    }
  });
  return jar;
}

module.exports = { curlFetch, install };
