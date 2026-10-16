import type { IsolatedRunHandle } from "./isolated-run-database";

interface LifecycleResources {
  pool: { end(): Promise<void> };
  handle: IsolatedRunHandle;
  poolClosed?: boolean;
  databaseDisposed?: boolean;
  results: Record<string, boolean>;
}

export async function cleanupLifecycleResources(
  state: LifecycleResources,
  dispose: (handle: IsolatedRunHandle) => Promise<void>,
): Promise<void> {
  const failures: unknown[] = [];
  if (!state.poolClosed) {
    try {
      await state.pool.end();
      state.poolClosed = true;
    } catch (error) {
      failures.push(error);
    }
  }
  if (!state.databaseDisposed) {
    try {
      await dispose(state.handle);
      state.databaseDisposed = true;
    } catch (error) {
      failures.push(error);
    }
  }
  state.results.cleanedUp = failures.length === 0;
  if (failures.length)
    throw new AggregateError(failures, "Lifecycle cleanup failed.");
}
