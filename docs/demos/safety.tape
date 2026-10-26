# Demo 5: a write against the local test site: refused by default, sent once, confirmed by a read,
# and a repeat refused. Run through docs/demos/record.sh.
Output docs/demos/safety.gif
Output docs/demos/safety.txt
Set Shell bash
Set FontFamily "Menlo"
Set FontSize 16
Set Width 1080
Set Height 360
Set Padding 20
Set TypingSpeed 20ms
Set WaitPattern /\$$/
Set WaitTimeout 60s

# Off-screen: an empty state dir; api-anything is this checkout's build (record.sh builds it). Start
# the fixture site (todo-fixture.mjs seeds two captures of its to-do page), and learn its list and its
# add from them. The add is learned from a request the --write capture aborted, so nothing was sent.
Hide
Type `export PS1='$ ' D=/tmp/api-anything-demo; export API_ANYTHING_HOME=$D/home-safety; rm -rf "$API_ANYTHING_HOME"; mkdir -p "$API_ANYTHING_HOME"; api-anything() { node "$DEMO_REPO/dist/cli.js" "$@"; }; cd "$DEMO_REPO"`
Enter
Wait
Type `node --import tsx docs/demos/todo-fixture.mjs > "$D/fixture.log" 2>&1 & until [ -s "$D/fixture.log" ]; do sleep 0.2; done`
Enter
Wait
Type `api-anything add todo list --from ctodos --pick-request 2 --extract todos >/dev/null && api-anything add todo add --from caddtodo --pick-request 2 --example 'title=buy milk' --write >/dev/null; clear`
Enter
Wait
Sleep 500ms
Show

Type "# Demo 5: a write to a local test site. Live, no cuts." Enter
Type `api-anything readback todo add list --find 'title={title}' | jq -c .readback` Enter
Wait
Sleep 1s
Type `api-anything call todo add title='pay rent' | jq -c '{ok, class, write}'` Enter
Wait
Sleep 1500ms
Type `api-anything call todo add title='pay rent' --allow-writes | jq -c '{ok, class, write, reason}'` Enter
Wait
Sleep 1500ms
Type `api-anything call todo add title='pay rent' --allow-writes | jq -c '{ok, class, write, retry}'` Enter
Wait
Sleep 1500ms
Type `api-anything call todo list | jq -c .data` Enter
Wait
Sleep 4s
Screenshot docs/demos/safety.png
Sleep 1s
Hide
Type `kill %1; clear`
Enter
