import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function testCandidate(root: string) {
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 16_000_000,
    });
  const hash = createHash("sha256");
  const files = git(
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
  )
    .split("\0")
    .filter(Boolean)
    .sort();
  for (const file of files) {
    hash.update(file).update("\0");
    try {
      hash.update(readFileSync(resolve(root, file)));
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw new Error("Cannot identify test candidate.");
      hash.update("deleted");
    }
    hash.update("\0");
  }
  return {
    commit: git("rev-parse", "HEAD").trim(),
    workingTreeDirty: git("status", "--porcelain").trim().length > 0,
    sourceDigest: hash.digest("hex"),
  };
}
