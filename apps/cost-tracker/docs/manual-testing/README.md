# Manual pair-testing

Everything a new agent session needs to guide the human through the Cost Tracker test journey, record results, and track findings — start here.

## Files

- [Journey script](journey.md) — the step-by-step pair-testing contract: identities, links, expected observations, stop signs. Follow it, one case at a time.
- [Run logs](runs/) — one `{run-key}.md` log per executed run, updated after every observed case. The [runs README](runs/README.md) holds the log template.
- Normative truth (linked from the journey, read when a case disputes expected behavior): [Claim workflow](../claim-workflow.md), [clickdummy traceability](../clickdummy/requirements-traceability.md), [Cost Tracker context](../../CONTEXT.md), [shared glossary](../../../../DOMAIN-GLOSSARY.md), [accepted ADRs](../../../../docs/adr/).

## Starting a session

1. Read this index, then [journey.md](journey.md) (contract, stop signs, run card).
2. Check for a resumed run: newest log in [runs/](runs/) (`Last completed case / resume case`) — continue there, never restart silently.
3. List open journey findings: `gh issue list --state open --label manual-test` (see [issue-tracker conventions](../../../../docs/agents/issue-tracker.md)); known blockers stay linked, not re-discovered.
4. Confirm dev server, run key, and mail delivery with the tester before case 01.

## During the session

- Give exactly one action per turn; record the observation in the run log **before** the next step.
- Failing cases become GitHub issues (label `manual-test`, tester approves before filing); link each issue back into the log line.
- Automated results never count as browser passes; blocked branches stop, independent branches may continue.
- No passwords, tokens, bank details, or full invitation links in tracked files — ever.

## Ending a session

Update the run log sign-off counts, next safe step, and open blockers; commit the log; report pass/fail/blocked totals plus new issue links.
