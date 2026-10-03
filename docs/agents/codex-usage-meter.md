# Codex quota gate

Applies only to new `openai-codex` child launches, not unrelated OpenAI API providers. Check the 5h meter once before a delegated wave; reuse that reading during the wave unless the reset passes or a quota error occurs. Never silently switch providers.

## Read the meter

- Interactive: launch `TZ=Etc/GMT-2 codex`, then `/status`; read the remaining 5h percentage and reset time.
- Headless: create a uniquely named scratch tmux session (not a shared `cx`), rooted in the trusted repo:

  ```bash
  tmux new-session -d -s <unique-session> -c <repo> -x 120 -y 40 'TZ=Etc/GMT-2 codex'
  ```

  Use plain `codex`; `--sandbox read-only` can hang its self-updater. If an update prompt appears, choose Skip, not an update. Wait for readiness, send `/status` and Enter (a second Enter may be needed), then capture the relevant lines with `tmux capture-pane ... | rg -a '5h limit|Weekly limit|resets'`. Close only that scratch session afterward. Never operate on another agent's CLI or tmux session.

Use **CEST (UTC+02:00)** consistently for this policy, including winter by explicit operator choice; `Etc/GMT-2` is the fixed UTC+02:00 zone. Record full dates and offsets, not ambiguous clock-only times. Convert a reset reported in another timezone before calculating the wake time. Meter access must not expose credentials.

## Pause, sleep, re-check, continue

While remaining 5h quota is below **15%**, pause new Codex launches. Preserve mission/run IDs, `cwd`/branch/ref, partial changes, and check state; let existing writers finish or checkpoint safely. Do not force a clean tree with resets, discard changes, or commit without permission.

1. Read the provider's next reset as an absolute timestamp. The wake time is **reset + 120 seconds**. Save both in the mission/checkpoint and give one short CEST wake-time notice.
2. Use an owned shell sleeping loop until that wake time, outside model reasoning. Keep its process/session handle so it can be cancelled or inspected; do not repeatedly call the model, meter, or subagent status while sleeping.
3. At wake, read the meter again. If quota is sufficient, continue the pending work on the same provider and apply the [resume-first recovery procedure](subagent-launch.md#recovery-and-durable-records). If it is still below 15%, repeat with the newly reported future reset.
4. Missing/ambiguous reset data, a reset that is already past after re-check, a weekly/provider block, or loss of the wait process requires a visible blocked report—not a tight retry loop or silent provider change. The human can cancel or override the wait at any time.

Example sleeper, after validating `reset_epoch` from the meter (Unix seconds):

```bash
wait_until=$((reset_epoch + 120))
TZ=Etc/GMT-2 date -d "@$wait_until" '+Resume check: %Y-%m-%d %H:%M:%S CEST (%:z)'
while (( $(date +%s) < wait_until )); do
  remaining=$((wait_until - $(date +%s)))
  if (( remaining <= 0 )); then break; fi
  sleep "$((remaining < 60 ? remaining : 60))"
done
```

Run the sleeper with a tool deadline long enough to reach the wake time or a managed long-running shell handle; a short tool timeout is not a wait strategy. This is an instruction policy, not an installed auto-restart service. A process/host restart requires recovery from the saved mission/checkpoint and a fresh meter reading.

A reset does not prove a full tank: other sessions can spend shared quota, and weekly limits may still block access. Weekly usage is informational at ordinary preflight; an actual weekly limit error must be surfaced.
