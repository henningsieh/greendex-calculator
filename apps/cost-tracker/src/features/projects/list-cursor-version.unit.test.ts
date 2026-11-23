import { describe, expect, it } from "vitest";

import {
  isObsoleteProjectCursor,
  PROJECT_CURSOR_VERSION,
  readProjectCursorVersion,
} from "@/features/projects/list-cursor-version";

const encode = (payload: unknown) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

describe("readProjectCursorVersion", () => {
  it("reads the version without verifying the cursor", () => {
    expect(readProjectCursorVersion(encode({ version: 5 }))).toBe(
      PROJECT_CURSOR_VERSION,
    );
    expect(readProjectCursorVersion(encode({ version: 4 }))).toBe(4);
  });

  it("returns null for anything that is not a decodable cursor payload", () => {
    expect(readProjectCursorVersion("")).toBeNull();
    expect(readProjectCursorVersion("not-a-cursor")).toBeNull();
    expect(
      readProjectCursorVersion(Buffer.from("project-1").toString("base64url")),
    ).toBeNull();
    expect(readProjectCursorVersion(encode(["version", 5]))).toBeNull();
    expect(readProjectCursorVersion(encode({ version: "5" }))).toBeNull();
    expect(readProjectCursorVersion(encode({ version: 5.5 }))).toBeNull();
  });
});

describe("isObsoleteProjectCursor", () => {
  it("flags only a readable version that is not the current one", () => {
    expect(isObsoleteProjectCursor(encode({ version: 4 }))).toBe(true);
    expect(isObsoleteProjectCursor(encode({ version: 5 }))).toBe(false);
    expect(isObsoleteProjectCursor("not-a-cursor")).toBe(false);
  });
});
