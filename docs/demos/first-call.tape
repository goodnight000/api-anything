# Demo 1: clean install from GitHub, then one public call. Run through docs/demos/record.sh.
Output docs/demos/first-call.gif
Output docs/demos/first-call.txt
Set Shell bash
Set FontFamily "Menlo"
Set FontSize 16
Set Width 1080
Set Height 900
Set Padding 20
Set TypingSpeed 20ms
Set WaitPattern /\$$/
Set WaitTimeout 180s

# Off-screen: a fresh state dir, npm prefix and npm cache, so nothing is reused from this machine.
Hide
Type `export PS1='$ ' NPM_CONFIG_UPDATE_NOTIFIER=false D=/tmp/api-anything-demo; rm -rf "$D"; mkdir -p "$D"; export API_ANYTHING_HOME=$D/home NPM_CONFIG_PREFIX=$D/prefix NPM_CONFIG_CACHE=$D/npm-cache PATH=$D/prefix/bin:$PATH; cd "$D"; clear`
Enter
Wait
Sleep 500ms
Show

Type "# Demo 1: install from GitHub, then call a bundled operation. Live, no cuts." Enter
Type "node -v; npm -v" Enter
Wait
Type "git clone -q https://github.com/goodnight000/api-anything.git && cd api-anything" Enter
Wait
Type "npm ci --no-audit --no-fund" Enter
Wait
Type `npm install -g "$(npm pack --silent)" --no-audit --no-fund` Enter
Wait
Type `api-anything sites | jq -r '.[] | "\(.name): \(.operations) ops"'` Enter
Wait
Type `api-anything call hacker-news search query=sqlite | jq '{ok, class, tier, ms, results: (.data | length), first: .data[0]}'` Enter
Wait
Sleep 4s
Screenshot docs/demos/first-call.png
Sleep 1s
