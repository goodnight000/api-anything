#!/usr/bin/env bash
# Teach one operation from two examples, then call it with an input it never saw.
# Needs api-anything on PATH, Google Chrome (only to learn) and jq (only to summarize).
# Usage: examples/teach-once.sh [domain]   (default arxiv.org)
set -euo pipefail
domain="${1:-arxiv.org}"
home="${API_ANYTHING_HOME:-$HOME/.api-anything}"

# Print a command exactly as written, then run it.
run() { printf '\033[1m$ %s\033[0m\n' "$1" >&2; eval "$1"; }

echo "# 1. Learn from two examples. Headless Chrome opens the page twice. Summarized with jq." >&2
run "$(cat <<'EOF'
api-anything add hn-demo links \
  --trigger 'https://news.ycombinator.com/from?site={domain}' \
  --example domain=github.com --example2 domain=github.io --match path=/from \
  --html '{"items":"tr.athing","fields":{"title":".titleline > a","url":".titleline > a@href"}}'
EOF
)" | jq '{ok, request, params, minTier, preview_items: .preview.count, preview_first: .preview.first.url}'

echo -e "\n# 2. The saved template has a slot where the domain goes." >&2
run "jq -c '.operations[] | select(.name == \"links\").slots' \"$home/sites/hn-demo.json\""

echo -e "\n# 3. Call it with a new input, plain HTTP only. Summarized with jq." >&2
run "api-anything call hn-demo links domain=$(printf %q "$domain") --max-tier 1" | jq --arg d "$domain" '
  [(.data // [])[].url | capture("^https?://(?<host>[^/]+)").host] as $hosts
  | {ok, class, tier, ms, reason, results: ($hosts | length),
     from_domain: ($hosts | map(select(. == $d or endswith("." + $d))) | length),
     first: [(.data // [])[:3][].url]}
  | ., if .results > 0 and .from_domain == .results then empty
       else error("results do not all come from \($d)") end'
