import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import {
  copyWorkspaceSource,
  linkWorkspaceDependencies,
  workspaceDigest,
} from "./private-app-workspace";

it("copies workspace dependencies without writable checkout source or local artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "greendex-workspace-test-"));
  const checkout = join(root, "checkout");
  const image = join(root, "image");
  try {
    await mkdir(join(checkout, "apps/calculator/node_modules/@greendex"), {
      recursive: true,
    });
    await mkdir(join(checkout, "packages/auth/node_modules/@greendex"), {
      recursive: true,
    });
    await mkdir(join(checkout, "packages/config"), { recursive: true });
    await mkdir(join(checkout, "node_modules/.bin"), { recursive: true });
    await mkdir(join(checkout, "apps/calculator/node_modules/.bin"));
    for (const workspace of [".", "apps/calculator"]) {
      await writeFile(
        join(checkout, workspace, "node_modules/.bin/next"),
        "checkout shim",
      );
    }
    await mkdir(join(checkout, "apps/calculator/.next"));
    await writeFile(join(checkout, "packages/config/source.ts"), "original");
    await writeFile(
      join(checkout, "apps/calculator/.next/private"),
      "dev output",
    );
    await writeFile(join(checkout, "packages/config/.env"), "secret");
    await symlink(
      join(checkout, "packages/auth"),
      join(checkout, "apps/calculator/node_modules/@greendex/auth"),
    );
    await symlink(
      join(checkout, "packages/config"),
      join(checkout, "packages/auth/node_modules/@greendex/config"),
    );
    await copyWorkspaceSource(checkout, image);
    const before = await workspaceDigest(image);
    await linkWorkspaceDependencies(checkout, image);
    expect(await workspaceDigest(image)).toBe(before);
    for (const workspace of [".", "apps/calculator"]) {
      await writeFile(
        join(image, workspace, "node_modules/.bin/next"),
        "rewritten image shim",
      );
      expect(
        await readFile(
          join(checkout, workspace, "node_modules/.bin/next"),
          "utf8",
        ),
      ).toBe("checkout shim");
      expect(
        await readFile(join(image, workspace, "node_modules/.bin/next"), "utf8"),
      ).toBe("rewritten image shim");
    }
    expect(
      await realpath(join(image, "apps/calculator/node_modules/@greendex/auth")),
    ).toBe(join(image, "packages/auth"));
    const config = await realpath(
      join(image, "packages/auth/node_modules/@greendex/config"),
    );
    expect(config).toBe(join(image, "packages/config"));
    await writeFile(join(config, "source.ts"), "private change");
    expect(
      await readFile(join(checkout, "packages/config/source.ts"), "utf8"),
    ).toBe("original");
    expect(await workspaceDigest(image)).not.toBe(before);
    await expect(readFile(join(image, "packages/config/.env"))).rejects.toThrow();
    await expect(
      readFile(join(image, "apps/calculator/.next/private")),
    ).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
