/**
 * Database client configuration
 * Handles connection pooling and Drizzle ORM setup
 */
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { relations } from "./relations";

type Database = NodePgDatabase<typeof relations>;

// Global variable to store the pool across hot reloads in development
declare global {
  var __pool: Pool | undefined;
}

let dbConnection: Database | undefined;

/**
 * Initialize and return the database instance
 * Lazily creates the connection on first access
 */
function initializeDb(): Database {
  if (dbConnection) {
    return dbConnection;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Reuse pool in development to prevent connection leaks during hot reload
  const pool = global.__pool ?? new Pool({ connectionString, max: 10 });
  global.__pool = pool;

  dbConnection = drizzle({ client: pool, relations });
  return dbConnection;
}

/**
 * Create a lazy-loading proxy for any object type
 */
function lazyProxy<T extends object>(initialize: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const instance = initialize();
      const value = Reflect.get(instance, prop, instance);
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
}

/**
 * Lazy-loading database client
 * Connection is established on first query
 */
export const db = lazyProxy<Database>(initializeDb);

/**
 * Create a new database connection with a custom connection string
 */
export function createDbConnection(connectionString: string): Database {
  const pool = new Pool({ connectionString, max: 10 });
  return drizzle({ client: pool, relations });
}
