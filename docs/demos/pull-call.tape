# Demo 4: pull a shared spec from the registry, then call it. Run through docs/demos/record.sh.
Output docs/demos/pull-call.gif
Output docs/demos/pull-call.txt
Set Shell bash
Set FontFamily "Menlo"
Set FontSize 16
Set Width 1080
Set Height 380
Set Padding 20
Set TypingSpeed 20ms
Set WaitPattern /\$$/
Set WaitTimeout 120s

# Off-screen: an empty state dir, and api-anything is this checkout's build (record.sh builds it).
Hide
Type `export PS1='$ ' D=/tmp/api-anything-demo; export API_ANYTHING_HOME=$D/home-pull; rm -rf "$API_ANYTHING_HOME"; api-anything() { node "$DEMO_REPO/dist/cli.js" "$@"; }; cd "$DEMO_REPO"; clear`
Enter
Wait
Sleep 500ms
Show

Type "# Demo 4: pull a spec someone shared, call it, then a bundled one. Plain HTTP, no browser. Live." Enter
Type `api-anything pull goodreads | jq -r '.operations[].op'` Enter
Wait
Sleep 1500ms
Type `api-anything call goodreads searchBooks q=piranesi | jq -c '{ok, class, tier, ms}, .data[0]'` Enter
Wait
Sleep 1500ms
Type `api-anything call hacker-news search query=sqlite | jq -c '{ok, class, tier, ms}, (.data[0] | {title, points})'` Enter
Wait
Sleep 4s
Screenshot docs/demos/pull-call.png
Sleep 1s
