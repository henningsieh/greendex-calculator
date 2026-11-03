// Shared test mock for the join-transaction auth boundary.
//
// Both participant-onboarding integration suites observe the real
// Better Auth transaction binding while keeping session/permission reads
// mocked. The `actual` module must be passed in from the test's
// `vi.mock("@/lib/auth", ...)` factory via `importOriginal`: this helper
// never imports `@/lib/auth` at runtime, so it always reaches the real
// `createJoinTransactionAuth` instead of the mock under construction.
import type { createJoinTransactionAuth } from "@/lib/auth";

type ActualAuthModule = {
  createJoinTransactionAuth: typeof createJoinTransactionAuth;
};

type JoinTransactionApi = ReturnType<typeof createJoinTransactionAuth>["api"];

type JoinTransactionAuthMocks = {
  addMember: (
    input: Parameters<JoinTransactionApi["addMember"]>[0],
    api: JoinTransactionApi,
  ) => ReturnType<JoinTransactionApi["addMember"]>;
  grantParticipantMembership: (
    input: Parameters<JoinTransactionApi["grantParticipantMembership"]>[0],
    api: JoinTransactionApi,
  ) => ReturnType<JoinTransactionApi["grantParticipantMembership"]>;
};

/**
 * Build the mocked `@/lib/auth` module: stubbed `auth.api` for
 * session reads plus a `createJoinTransactionAuth` that binds the real
 * Better Auth APIs to the join transaction and exposes them to the
 * `authMocks` spies as `(input, realApi)`.
 */
export function createJoinTransactionAuthMock<
  TMocks extends JoinTransactionAuthMocks,
>(authMocks: TMocks, actual: ActualAuthModule) {
  return {
    auth: { api: authMocks },
    createJoinTransactionAuth: (
      tx: Parameters<ActualAuthModule["createJoinTransactionAuth"]>[0],
    ) => {
      const real = actual.createJoinTransactionAuth(tx);
      return {
        api: {
          addMember: (input: Parameters<JoinTransactionApi["addMember"]>[0]) =>
            authMocks.addMember(input, real.api),
          grantParticipantMembership: (
            input: Parameters<
              JoinTransactionApi["grantParticipantMembership"]
            >[0],
          ) => authMocks.grantParticipantMembership(input, real.api),
        },
      };
    },
  };
}
