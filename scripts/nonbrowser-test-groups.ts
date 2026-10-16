export type GroupStatus = "passed" | "failed" | "blocked";
export type GroupExecution = "serial" | "parallel" | "cleanup";
export interface GroupResult {
  group: string;
  status: GroupStatus;
  durationMs: number;
}
export interface TestGroup {
  name: string;
  prerequisites: string[];
  execution: GroupExecution;
  run(): Promise<void>;
}

export const nonbrowserPackages = [
  "auth",
  "email",
  "database",
  "config",
  "i18n",
] as const;

export async function runTestGroups(groups: TestGroup[]): Promise<GroupResult[]> {
  const results = new Map<string, GroupResult>();
  const names = new Map<string, GroupExecution>();
  for (const group of groups) {
    if (
      names.has(group.name) ||
      group.prerequisites.some(
        (name) =>
          !names.has(name) ||
          (group.execution !== "cleanup" && names.get(name) === "cleanup"),
      )
    )
      throw new Error("Duplicate group or invalid prerequisite.");
    names.set(group.name, group.execution);
  }
  const pending = groups.filter(({ execution }) => execution !== "cleanup");
  const cleanup = groups.filter(({ execution }) => execution === "cleanup");
  const execute = async (group: TestGroup): Promise<void> => {
    const started = Date.now();
    let status: GroupStatus = "blocked";
    if (
      group.execution === "cleanup" ||
      group.prerequisites.every((name) => results.get(name)?.status === "passed")
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
    results.set(group.name, result);
    console.log(`${status.toUpperCase()} ${group.name} (${result.durationMs}ms)`);
  };
  while (pending.length) {
    const ready = pending.filter(({ prerequisites }) =>
      prerequisites.every((name) => results.has(name)),
    );
    if (!ready.length) throw new Error("Test group dependencies are unresolved.");
    const parallel = ready.filter(({ execution }) => execution === "parallel");
    const batch = parallel.length ? parallel : [ready[0]];
    await Promise.all(batch.map(execute));
    for (const group of batch) pending.splice(pending.indexOf(group), 1);
  }
  for (const group of cleanup) await execute(group);
  return groups.map(({ name }) => {
    const result = results.get(name);
    if (!result) throw new Error("Test group did not produce a result.");
    return result;
  });
}

export function fullRunPassed(results: GroupResult[]): boolean {
  return (
    results.length > 0 && results.every((result) => result.status === "passed")
  );
}
