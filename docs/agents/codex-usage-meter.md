# Codex 5h usage meter

- Interactive: `codex`, then `/status` → read `5h limit` % + reset time.
- Headless (same numbers, scriptable; verified working):
  `tmux new-session -d -s cx -c <repo> -x 120 -y 40 'codex'`
  (plain `codex`: `--sandbox read-only` hangs the self-updater download and yields an empty pane)
  If an `Update available` prompt blocks launch, answer `2` (Skip) via `tmux send-keys -t cx '2' Enter` — never auto-update mid-poll.
  wait ~12s (split waits across calls; long single sleeps get aborted)
  `tmux send-keys -t cx '/status' Enter`
  text may compose without submitting → send `tmux send-keys -t cx Enter` AGAIN separately
  wait ~6s, then `tmux capture-pane -t cx -p -S -80 | rg -a "5h limit|Weekly limit|resets"`
  `tmux kill-session -t cx` afterwards
- Trust "Trust this folder?" only for known dirs; pin subagent cwd to the repo.
- Run rule: check before launching ticket subagents; 5h below 15% → stop, tree clean, report. Weekly moves slowly — informational only, never a launch gate.
