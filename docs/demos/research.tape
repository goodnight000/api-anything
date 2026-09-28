# Demo 3: public stories + LinkedIn company search and detail lookups. Run through docs/demos/record.sh.
Output docs/demos/research.gif
Output docs/demos/research.txt
Set Shell bash
Set FontFamily "Menlo"
Set FontSize 16
Set Width 1080
Set Height 640
Set Padding 20
Set TypingSpeed 20ms
Set WaitPattern /\$$/
Set WaitTimeout 180s

# Off-screen: copy an existing LinkedIn session (made by `api-anything login linkedin`) into demo 1's state dir.
Hide
Type `export PS1='$ ' D=/tmp/api-anything-demo; export API_ANYTHING_HOME=$D/home PATH=$D/prefix/bin:$PATH; mkdir -p "$D/home/sessions"; chmod 700 "$D/home" "$D/home/sessions"; cp -p "$HOME/.api-anything/sessions/linkedin.json" "$D/home/sessions/"; cd "$DEMO_REPO"; clear`
Enter
Wait
Sleep 500ms
Show

Type "# Demo 3: HN story search + LinkedIn company search, then details by returned ID." Enter
Type "# Live, no cuts, reads only. LinkedIn session imported earlier (api-anything login)." Enter
Type "node examples/research.mjs anthropic --linkedin > /tmp/brief.json && echo saved" Enter
Wait
Type `jq -r '.stories[] | [.points, .date, .title] | @tsv' /tmp/brief.json` Enter
Wait
Type `jq -r '.companies[] | [.universalName, .staff, .name, .industry] | @tsv' /tmp/brief.json` Enter
Wait
Type `jq -r '.calls[] | [.op, (.args | tostring), "tier \(.tier)", "\(.ms) ms"] | @tsv' /tmp/brief.json` Enter
Wait
Sleep 5s
Screenshot docs/demos/research.png
Sleep 1s
