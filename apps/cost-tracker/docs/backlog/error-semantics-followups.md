# Error-semantics follow-ups (from live dev-log review, not blocking MVP)

All three are wrong-code-or-message issues in authorization-adjacent errors. Behavior (denial itself) is correct and browser-tested; only the reported code/message needs fixing.

1. **`projects/get` maps "not a member" to 500.** Better Auth correctly reports 401 `USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION`, but the route bubbles it as 500. Fix: map to clean 401/403 in the route. Refs: `src/app/api/rpc/[[...rest]]/route.ts`, `projects/get` procedure.
2. **Incomplete Participant profile returns 403 FORBIDDEN.** `list-my-projects.ts:52` throws FORBIDDEN "Complete your Participant profile before accessing Projects." A missing profile is a client-state problem, not an authorization failure — should be 400/422-family. Fix: change code (keep message), update affected tests.
3. **"Hosted Project is unavailable." mismatches FORBIDDEN.** `coordination.ts:71` (`requireHostCoordination`) throws 403 with an availability message. Either the code is wrong (the project exists; the actor lacks scope → message should say no access) or the message is wrong. Fix: align code+message (suggested: keep 403, message naming the missing scope), update affected tests.

Rule for all three: fix code+message together, update unit/integration/e2e expectations in the same commit, full suite green after.
