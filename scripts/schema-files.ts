import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Every feature schema module the repository checks share one location rule. */
export function findSchemaModules(root: string): string[] {
  const files: string[] = [];
  for (const workspace of ["apps", "packages"]) {
    const workspaceDirectory = join(root, workspace);
    if (!existsSync(workspaceDirectory)) continue;
    for (const entry of readdirSync(workspaceDirectory, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) continue;
      const sourceDirectory = join(workspaceDirectory, entry.name, "src");
      if (!existsSync(sourceDirectory)) continue;
      for (const file of readdirSync(sourceDirectory, {
        recursive: true,
        withFileTypes: true,
      })) {
        if (!file.isFile() || file.name !== "validation-schemas.ts") continue;
        files.push(join(file.parentPath, file.name));
      }
    }
  }
  return files.sort();
}
