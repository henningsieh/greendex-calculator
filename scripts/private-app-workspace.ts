import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readdir,
  readFile,
  realpath,
  symlink,
} from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";

const excluded = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  "test-results",
  "playwright-report",
  ".playwright",
  ".auth",
  "coverage",
  "dist",
  "build",
]);

function include(path: string): boolean {
  const name = basename(path);
  return (
    !excluded.has(name) &&
    !name.startsWith(".env") &&
    !name.startsWith(".tsconfig-test-") &&
    !name.endsWith(".tsbuildinfo")
  );
}

export async function copyWorkspaceSource(
  source: string,
  destination: string,
): Promise<void> {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source)) {
    const from = resolve(source, entry);
    if (include(from))
      await cp(from, resolve(destination, entry), {
        recursive: true,
        dereference: true,
        filter: include,
      });
  }
}

export async function workspaceDigest(
  root: string,
  image = root,
): Promise<string> {
  const hash = createHash("sha256");
  async function visit(directory: string): Promise<void> {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const path = resolve(directory, entry.name);
      if (!include(path)) continue;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name !== "next-env.d.ts") {
        hash.update(relative(root, path));
        hash.update("\0");
        hash.update(await readFile(resolve(image, relative(root, path))));
        hash.update("\0");
      }
    }
  }
  await visit(root);
  return hash.digest("hex");
}

/** Installed vendor dependencies are read-only; workspace links resolve copied source. */
export async function linkWorkspaceDependencies(
  checkout: string,
  image: string,
): Promise<void> {
  const workspaces = ["."];
  for (const group of ["apps", "packages"]) {
    try {
      for (const entry of await readdir(resolve(image, group), {
        withFileTypes: true,
      }))
        if (entry.isDirectory()) workspaces.push(`${group}/${entry.name}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const mappings = await Promise.all(
    workspaces
      .filter((path) => path !== ".")
      .map(async (path) => ({
        source: await realpath(resolve(checkout, path)),
        destination: resolve(image, path),
      })),
  );
  async function linkTree(source: string, destination: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(source, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    await mkdir(destination, { recursive: true });
    for (const entry of entries) {
      const from = resolve(source, entry.name);
      const to = resolve(destination, entry.name);
      if (entry.name === ".bin") {
        await cp(from, to, { recursive: true, dereference: true });
      } else if (entry.name.startsWith("@") && entry.isDirectory()) {
        await linkTree(from, to);
      } else {
        const target = await realpath(from);
        const workspace = mappings.find(
          ({ source }) => target === source || target.startsWith(source + sep),
        );
        if (
          workspace &&
          !relative(workspace.source, target).split(sep).includes("node_modules")
        ) {
          await symlink(
            resolve(workspace.destination, relative(workspace.source, target)),
            to,
          );
        } else {
          await symlink(target, to);
        }
      }
    }
  }
  for (const workspace of workspaces)
    await linkTree(
      resolve(checkout, workspace, "node_modules"),
      resolve(image, workspace, "node_modules"),
    );
}
