#!/usr/bin/env bash
# Real-cart pricing check without a browser: the same ten cases as
# specs/pricing.spec.js, asked of Shopify's own cart API with curl, so the
# multi-buy tiers and The ZOREV Pair can be verified from any machine that
# can reach the store, including ones the storefront's bot protection
# challenges when they run headless Chromium.
#
#   ./pricing-curl.sh                  live theme
#   PREVIEW_THEME_ID=1234 ./pricing-curl.sh
#
# Every expectation is what the store's discount engine returns; nothing
# here computes a price.
set -u
BASE="${BASE_URL:-https://www.zorev.org}"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
JAR="$(mktemp)"; trap 'rm -f "$JAR"' EXIT
GAP="${GAP_SECONDS:-3}"
GODA_BLACK=49337208045819; GODA_WHITE=49337208078587; HOYGI=49337209258235

api() { # method path [json]
  local m="$1" p="$2" d="${3:-}"
  local args=(-sS -A "$UA" -b "$JAR" -c "$JAR" -H "Accept: application/json" -H "Content-Type: application/json" --compressed)
  if [ "$m" = POST ]; then args+=(-X POST --data-binary "$d"); fi
  curl "${args[@]}" -w '\n%{http_code}' "$BASE$p"
}

# The cart API is theme-independent, so PREVIEW_THEME_ID is accepted for
# symmetry with the Playwright suite but changes nothing here.

pass=0; fail=0
check() { # name items_json expected_total expected_discount [expected_title]
  local name="$1" items="$2" total="$3" saved="$4" title="${5:-}"
  local r code body
  # A new jar per case is a new, empty cart. Not POST /cart/clear.js: a clear
  # followed by an add is a cart-bot signature the store challenges on sight.
  : > "$JAR"
  r=$(api POST /cart/add.js "{\"items\":$items}"); code="${r##*$'\n'}"
  if [ "$code" != 200 ]; then echo "FAIL  $name: add returned HTTP $code"; fail=$((fail+1)); sleep "$GAP"; return; fi
  sleep "$GAP"
  r=$(api GET /cart.js); code="${r##*$'\n'}"; body="${r%$'\n'*}"
  if [ "$code" != 200 ]; then echo "FAIL  $name: cart.js returned HTTP $code"; fail=$((fail+1)); sleep "$GAP"; return; fi
  local got_total got_saved titles
  got_total=$(printf '%s' "$body" | python3 -c 'import json,sys; c=json.load(sys.stdin); print(c["total_price"])')
  got_saved=$(printf '%s' "$body" | python3 -c 'import json,sys; c=json.load(sys.stdin); print(c["total_discount"])')
  titles=$(printf '%s' "$body" | python3 -c 'import json,sys; c=json.load(sys.stdin); t=set()
for i in c["items"]:
  for a in i.get("line_level_discount_allocations",[]): t.add(a["discount_application"]["title"])
for d in c.get("cart_level_discount_applications",[]): t.add(d["title"])
print(" | ".join(sorted(t)))')
  local ok=1
  [ "$got_total" = "$total" ] || ok=0
  [ "$got_saved" = "$saved" ] || ok=0
  if [ -n "$title" ]; then case "$titles" in *"$title"*) ;; *) ok=0;; esac; fi
  if [ $ok = 1 ]; then echo "ok    $name  (total=$got_total saved=$got_saved${titles:+ · $titles})"; pass=$((pass+1));
  else echo "FAIL  $name  expected total=$total saved=$saved${title:+ title='$title'}; got total=$got_total saved=$got_saved titles='$titles'"; fail=$((fail+1)); fi
  sleep "$GAP"
}

check "GODA x1 = \$30"                        "[{\"id\":$GODA_BLACK,\"quantity\":1}]" 3000 0
check "GODA x2 = \$54 (save \$6)"             "[{\"id\":$GODA_BLACK,\"quantity\":2}]" 5400 600 "GODA · Buy 2 · Save \$6"
check "GODA x3 = \$76 (save \$14)"            "[{\"id\":$GODA_BLACK,\"quantity\":3}]" 7600 1400 "GODA · Buy 3 · Save \$14"
check "GODA Black + White = \$54"             "[{\"id\":$GODA_BLACK,\"quantity\":1},{\"id\":$GODA_WHITE,\"quantity\":1}]" 5400 600
check "HOYGI x1 = \$25"                       "[{\"id\":$HOYGI,\"quantity\":1}]" 2500 0
check "HOYGI x2 = \$44 (save \$6)"            "[{\"id\":$HOYGI,\"quantity\":2}]" 4400 600 "HOYGI · Buy 2 · Save \$6"
check "HOYGI x3 = \$63 (save \$12)"           "[{\"id\":$HOYGI,\"quantity\":3}]" 6300 1200 "HOYGI · Buy 3 · Save \$12"
check "Pair GODA + HOYGI = \$47 (save \$8)"   "[{\"id\":$GODA_BLACK,\"quantity\":1},{\"id\":$HOYGI,\"quantity\":1}]" 4700 800 "The ZOREV Pair · Save \$8"
check "GODA x2 + HOYGI x1 = \$71"             "[{\"id\":$GODA_BLACK,\"quantity\":2},{\"id\":$HOYGI,\"quantity\":1}]" 7100 1400
check "GODA x1 + HOYGI x2 = \$66"             "[{\"id\":$GODA_BLACK,\"quantity\":1},{\"id\":$HOYGI,\"quantity\":2}]" 6600 1400
echo "passed=$pass failed=$fail"
[ "$fail" = 0 ]
