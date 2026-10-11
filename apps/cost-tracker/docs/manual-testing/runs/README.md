# Manual pair-test run notes

Follow [the journey(../journey.md). At the beginning of each run create a new `{key}.md` in this directory and update it **after each observed case**. A run log is a record of what happened, not a new specification. Do not commit logs containing sensitive data. Keep full setup/invitation/registration links, verification messages, passwords and banking details **outside** this directory.

Copy this outline into the new run log:

```md
# Cost Tracker manual run {key}

Date/time + timezone:
Tester / assistant:
Base URL and disposable environment:
Mail alias delivery checked:
Agreement version / published?:
Participant entry-point UI present?:
Payout Account creation available?:
Last completed case / resume case:

| Case | Account + active Organization | Redacted route | Result | Actual vs expected | Issue | Dependency / next action |
| ---- | ----------------------------- | -------------- | ------ | ------------------ | ----- | ------------------------ |

## Findings awaiting issue approval

## Sign-off

PASS: 0 · FAIL: 0 · BLOCKED: 0 · AUTOMATED-ONLY: 0 · NOT-RUN: 0
Open blockers:
Next safe step:
```

Allowed results: **PASS**, **FAIL**, **BLOCKED** (with named prerequisite), **AUTOMATED-ONLY** (never count as browser pass), **NOT-RUN**. Redact URLs with link secrets, query strings and invitation IDs; keep only safe route patterns or truncated identifiers. Note if a case is a UI gap versus a requirement conflict versus infrastructure failure.
