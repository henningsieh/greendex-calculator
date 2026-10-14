import { randomUUID } from "node:crypto";

import { Pool } from "pg";

/**
 * Isolated per-run test database lifecycle.
 *
 * One full non-browser run creates exactly one uniquely owned database on the
 * configured Postgres service, migrates and seeds it once, and points both
 * app contexts (including subprocesses) at that same database. Run ownership
 * is proven by a database comment marker, not by the name alone, and every
 * destructive statement re-verifies ownership plus target safety first.
 *
 * Safety contract:
 * - The caller passes the service URL explicitly (`DATABASE_URL`). A missing
 *   URL is a hard error: nothing here ever falls back to the ordinary
 *   development database.
 * - `disposeIsolatedRunDatabase` refuses protected names, the service default
 *   database, pattern violations, and ownership mismatches before issuing any
 *   destructive statement. Cleanup failures throw so the run reports failure.
 * - Runs are serial within a process (a second concurrent create is
 *   rejected) and isolated across processes (every run owns a unique
 *   database name plus its marker). The caller closes run-owned pools before
 *   disposal; `DROP ... WITH (FORCE)` is only the backstop.
 * - Reports must use {@link redactDatabaseUrl}: handles carry credentials
 *   in memory and must never be printed raw.
 */

const PREFIX_PATTERN = /^[a-z_]+$/;
const RUN_ID_PATTERN = /^[0-9a-f]{32}$/;
const RUN_DATABASE_NAME_PATTERN = /^[a-z_]+_[0-9a-f]{32}$/;
const OWNERSHIP_MARKER_PREFIX = "greendex-test-run:";

const PROTECTED_DATABASE_NAMES = new Set([
  "postgres",
  "template0",
  "template1",
  "greendex_development",
]);

/** Name of the process-serial slot: at most one owned run database at a time. */
let activeRunDatabaseName: string | null = null;

export interface CreateIsolatedRunDatabaseOptions {
  /** Explicit service URL; never defaulted, so setup failures cannot silently use dev data. */
  baseDatabaseUrl: string;
  /** Lowercase fixture alphabet; becomes the database name prefix. */
  prefix: string;
}

export interface IsolatedRunHandle {
  runId: string;
  databaseName: string;
  databaseUrl: string;
  baseDatabaseUrl: string;
  baseDatabaseName: string;
  serviceHost: string;
  servicePort: string;
  createdAt: string;
}

export class IsolatedRunCreationError extends Error {
  declare readonly handle: IsolatedRunHandle;

  constructor(
    handle: IsolatedRunHandle,
    readonly rollback: "disposed" | "failed",
    cause: unknown,
  ) {
    super(
      `Run database "${handle.databaseName}" preparation failed; rollback ${rollback}.`,
      { cause },
    );
    this.name = "IsolatedRunCreationError";
    Object.defineProperty(this, "handle", { value: handle, enumerable: false });
  }

  // Vitest traverses non-enumerable Error properties too: serialization must
  // explicitly omit credential URLs while callers retain the disposal handle.
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      stack: this.stack,
      rollback: this.rollback,
      runId: this.handle.runId,
      databaseName: this.handle.databaseName,
      cause: "Database preparation or connection cleanup failed.",
    };
  }
}

export interface DropTargetAssertion {
  serviceHost: string;
  servicePort: string;
  databaseName: string;
  /** Ownership marker read back from the service; null when absent. */
  marker: string | null;
  expectedRunId: string;
  baseDatabaseName: string;
}

export function buildRunDatabaseName(prefix: string, runId: string): string {
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new Error(
      `Invalid fixture database prefix "${prefix}": use [a-z_]+ so run databases stay distinguishable.`,
    );
  }
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error(
      "Invalid run id: expected 32 lowercase hex characters so concurrent runs never share a database.",
    );
  }
  return `${prefix}_${runId}`;
}

export function ownershipMarkerFor(runId: string): string {
  return `${OWNERSHIP_MARKER_PREFIX}${runId}`;
}

export function parseOwnershipMarkerValue(marker: string | null): string | null {
  if (!marker || !marker.startsWith(OWNERSHIP_MARKER_PREFIX)) return null;
  const runId = marker.slice(OWNERSHIP_MARKER_PREFIX.length);
  return RUN_ID_PATTERN.test(runId) ? runId : null;
}

export function isProtectedDatabaseName(databaseName: string): boolean {
  return PROTECTED_DATABASE_NAMES.has(databaseName);
}

/**
 * Fail-closed target check for destructive cleanup. Throws before any
 * destructive statement unless the target is an owned run database on the
 * expected service that is not the service default database.
 */
export function assertSafeDropTarget(target: DropTargetAssertion): void {
  if (
    isProtectedDatabaseName(target.databaseName) ||
    target.databaseName === target.baseDatabaseName
  ) {
    throw new Error(
      `Refusing to drop "${target.databaseName}": protected or service default database.`,
    );
  }
  if (!RUN_DATABASE_NAME_PATTERN.test(target.databaseName)) {
    throw new Error(
      `Refusing to drop "${target.databaseName}": outside the run-database name pattern.`,
    );
  }
  const markerRunId = parseOwnershipMarkerValue(target.marker);
  if (markerRunId === null || markerRunId !== target.expectedRunId) {
    throw new Error(
      `Refusing to drop "${target.databaseName}": ownership marker mismatch (names alone prove nothing).`,
    );
  }
}

/** Strip credentials for reports; never log a raw database URL. */
export function redactDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "[unparseable-database-url]";
  }
}

function serviceUrlFor(baseDatabaseUrl: string, databaseName: string): string {
  const url = new URL(baseDatabaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function maintenanceUrlFor(baseDatabaseUrl: string): string {
  const url = new URL(baseDatabaseUrl);
  url.pathname = "/postgres";
  return url.toString();
}

async function readOwnershipMarker(
  admin: Pool,
  databaseName: string,
): Promise<string | null> {
  const result = await admin.query<{ marker: string | null }>(
    // Databases are shared objects: their comments live in pg_shdescription,
    // so only shobj_description() sees them (obj_description() stays empty).
    `SELECT shobj_description(d.oid, 'pg_database') AS marker
     FROM pg_database d WHERE d.datname = $1`,
    [databaseName],
  );
  return result.rows[0]?.marker ?? null;
}

export async function createIsolatedRunDatabase(
  options: CreateIsolatedRunDatabaseOptions,
): Promise<IsolatedRunHandle> {
  if (!options.baseDatabaseUrl) {
    throw new Error(
      "Refusing to prepare a run database without an explicit DATABASE_URL: setup failures must never fall back to the ordinary development database.",
    );
  }
  const runId = randomUUID().replaceAll("-", "");
  const databaseName = buildRunDatabaseName(options.prefix, runId);
  if (activeRunDatabaseName !== null) {
    throw new Error(
      `Refusing to create "${databaseName}": run database "${activeRunDatabaseName}" is already active in this process; database runs stay serial.`,
    );
  }
  const base = new URL(options.baseDatabaseUrl);
  const handle: IsolatedRunHandle = {
    runId,
    databaseName,
    databaseUrl: serviceUrlFor(options.baseDatabaseUrl, databaseName),
    baseDatabaseUrl: options.baseDatabaseUrl,
    baseDatabaseName: base.pathname.replace(/^\//, ""),
    serviceHost: base.hostname,
    servicePort: base.port || "5432",
    createdAt: new Date().toISOString(),
  };
  assertSafeDropTarget({
    ...handle,
    marker: ownershipMarkerFor(runId),
    expectedRunId: runId,
  });
  let created = false;
  const admin = new Pool({
    connectionString: maintenanceUrlFor(options.baseDatabaseUrl),
    max: 1,
  });
  activeRunDatabaseName = databaseName;
  let preparationError: unknown;
  let rollback: "disposed" | "failed" = "failed";
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    await admin.query(
      `COMMENT ON DATABASE "${databaseName}" IS '${ownershipMarkerFor(runId)}'`,
    );
    // Fail closed when the service does not persist the ownership marker.
    const marker = await readOwnershipMarker(admin, databaseName);
    if (parseOwnershipMarkerValue(marker) !== runId) {
      throw new Error(
        `Run database "${databaseName}" did not persist its ownership marker; refusing an unowned database.`,
      );
    }
  } catch (error) {
    activeRunDatabaseName = null;
    preparationError = error;
    if (created) {
      // Successful CREATE proves this exact fresh database belonged to this
      // call. Only this same connection may roll back before marker persistence;
      // later disposal still requires the persisted marker, never name alone.
      try {
        await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
        rollback = "disposed";
      } catch (rollbackError) {
        preparationError = new AggregateError(
          [error, rollbackError],
          "Preparation and rollback failed",
        );
      }
    }
  }
  try {
    await admin.end();
  } catch (error) {
    activeRunDatabaseName = null;
    preparationError =
      preparationError === undefined
        ? error
        : new AggregateError(
            [preparationError, error],
            "Preparation and connection cleanup failed",
          );
  }
  if (preparationError !== undefined) {
    if (created)
      throw new IsolatedRunCreationError(handle, rollback, preparationError);
    throw preparationError;
  }
  return handle;
}

export async function disposeIsolatedRunDatabase(
  handle: IsolatedRunHandle,
): Promise<void> {
  // Shape check first: never connect for a target that is already unsafe.
  assertSafeDropTarget({
    serviceHost: handle.serviceHost,
    servicePort: handle.servicePort,
    databaseName: handle.databaseName,
    marker: ownershipMarkerFor(handle.runId),
    expectedRunId: handle.runId,
    baseDatabaseName: handle.baseDatabaseName,
  });
  const admin = new Pool({
    connectionString: maintenanceUrlFor(handle.baseDatabaseUrl),
    max: 1,
  });
  try {
    const adminService = new URL(maintenanceUrlFor(handle.baseDatabaseUrl));
    if (
      adminService.hostname !== handle.serviceHost ||
      (adminService.port || "5432") !== handle.servicePort
    ) {
      throw new Error(
        `Refusing to drop "${handle.databaseName}": service target changed since creation.`,
      );
    }
    const marker = await readOwnershipMarker(admin, handle.databaseName);
    assertSafeDropTarget({
      serviceHost: handle.serviceHost,
      servicePort: handle.servicePort,
      databaseName: handle.databaseName,
      marker,
      expectedRunId: handle.runId,
      baseDatabaseName: handle.baseDatabaseName,
    });
    // The caller closes run-owned pools first; FORCE only covers stragglers.
    await admin.query(`DROP DATABASE "${handle.databaseName}" WITH (FORCE)`);
  } finally {
    await admin.end();
    if (activeRunDatabaseName === handle.databaseName) {
      activeRunDatabaseName = null;
    }
  }
}
