# Demo 2: learn an operation from two examples, call it with new inputs. Run through docs/demos/record.sh.
Output docs/demos/teach-once.gif
Output docs/demos/teach-once.txt
Set Shell bash
Set FontFamily "Menlo"
Set FontSize 16
Set Width 1080
Set Height 860
Set Padding 20
Set TypingSpeed 20ms
Set WaitPattern /\$$/
Set WaitTimeout 180s

# Off-screen: use demo 1's state dir and install, and forget any earlier hn-demo spec.
Hide
Type `export PS1='$ ' D=/tmp/api-anything-demo; export API_ANYTHING_HOME=$D/home PATH=$D/prefix/bin:$PATH; rm -f "$API_ANYTHING_HOME/sites/hn-demo.json"; cd "$DEMO_REPO"; clear`
Enter
Wait
Sleep 500ms
Show

Type "# Demo 2: learn an operation from two examples, then call it with new input. Live, no cuts." Enter
Type "./examples/teach-once.sh arxiv.org" Enter
Wait
Sleep 4s
Screenshot docs/demos/teach-once.png
Sleep 1s
Type "clear" Enter
Type "# Same operation over MCP with another input (a scripted MCP client, no LLM):" Enter
Type "node examples/mcp-call.mjs hn-demo links domain=nature.com" Enter
Wait
Sleep 5s
