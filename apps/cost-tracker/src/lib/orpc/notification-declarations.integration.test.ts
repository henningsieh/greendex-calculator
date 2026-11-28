// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }));

import { notificationIntentFor } from "@/features/notifications/procedures/actions";
import { router } from "@/lib/orpc/router";

type RouterLeaf = { path: string; procedure: object };

function isProcedure(value: unknown): value is object {
  return typeof value === "object" && value !== null && "~orpc" in value;
}

function routerLeaves(node: object, path: string[] = []): RouterLeaf[] {
  return Object.entries(node).flatMap(([key, value]) => {
    if (isProcedure(value))
      return [{ path: [...path, key].join("."), procedure: value }];
    if (typeof value === "object" && value !== null)
      return routerLeaves(value, [...path, key]);
    return [];
  });
}

const leaves = routerLeaves(router);

describe("notification declarations on the Cost Tracker router", () => {
  it("finds every router entry", () => {
    expect(leaves.length).toBeGreaterThan(50);
  });

  it("requires every router entry to declare an intent or explicit null", () => {
    const missing = leaves
      .filter(({ procedure }) => notificationIntentFor(procedure) === undefined)
      .map(({ path }) => path);
    expect(missing).toEqual([]);
  });

  it("carries the claim.paid intent on the paid action", () => {
    const markPaid = leaves.find(({ path }) => path === "claims.markPaid");
    expect(markPaid).toBeDefined();
    expect(notificationIntentFor(markPaid!.procedure)).not.toBeNull();
    expect(notificationIntentFor(markPaid!.procedure)).not.toBeUndefined();
  });
});
