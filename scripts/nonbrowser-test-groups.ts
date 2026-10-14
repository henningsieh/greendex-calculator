export type GroupStatus = "passed" | "failed" | "blocked";
export interface GroupResult {
  group: string;
  status: GroupStatus;
  durationMs: number;
}
export interface TestGroup {
  name: string;
  prerequisites: string[];
  run(): Promise<void>;
}

/** Serial execution protects the shared seed; failures only block dependents. */
export async function runTestGroups(groups: TestGroup[]): Promise<GroupResult[]> {
  const results: GroupResult[] = [];
  const names = new Set<string>();
  for (const group of groups) {
    if (
      names.has(group.name) ||
      group.prerequisites.some((name) => !names.has(name))
    )
      throw new Error("Duplicate group or unknown prerequisite.");
    names.add(group.name);
  }
  for (const group of groups) {
    const started = Date.now();
    let status: GroupStatus = "blocked";
    if (
      group.prerequisites.every((name) =>
        results.some(
          (result) => result.group === name && result.status === "passed",
        ),
      )
    ) {
      try {
        await group.run();
        status = "passed";
      } catch {
        // Subprocess errors may contain credentials, cookies, and mail links.
        status = "failed";
      }
    }
    const result = {
      group: group.name,
      status,
      durationMs: Date.now() - started,
    };
    results.push(result);
    console.log(`${status.toUpperCase()} ${group.name} (${result.durationMs}ms)`);
  }
  return results;
}

export function fullRunPassed(results: GroupResult[]): boolean {
  return (
    results.length > 0 && results.every((result) => result.status === "passed")
  );
}
