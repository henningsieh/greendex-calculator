import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { expect, it, vi } from "vitest";

import { testCandidate } from "./test-candidate";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

it("identifies the commit and current file bytes, including uncommitted and deleted sources", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "greendex-candidate-"));
  vi.mocked(execFileSync).mockImplementation((_command, args) => {
    if (args?.[0] === "ls-files") return "source.ts\0new.ts\0";
    if (args?.[0] === "rev-parse") return "candidate-sha\n";
    return " M source.ts\n";
  });
  try {
    await writeFile(resolve(directory, "source.ts"), "first");
    await writeFile(resolve(directory, "new.ts"), "uncommitted");
    const first = testCandidate(directory);
    expect(first).toEqual({
      commit: "candidate-sha",
      workingTreeDirty: true,
      sourceDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(testCandidate(directory)).toEqual(first);
    await writeFile(resolve(directory, "source.ts"), "second");
    const second = testCandidate(directory);
    expect(second.sourceDigest).not.toBe(first.sourceDigest);
    await rm(resolve(directory, "new.ts"));
    expect(testCandidate(directory).sourceDigest).not.toBe(second.sourceDigest);
  } finally {
    vi.resetAllMocks();
    await rm(directory, { recursive: true, force: true });
  }
});
