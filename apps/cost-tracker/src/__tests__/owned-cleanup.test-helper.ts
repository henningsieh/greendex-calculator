import type { db } from "@greendex/database";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

type Executor = Pick<typeof db, "execute">;

export function ownedCleanup(
  executor: Executor,
  organizationIds: readonly string[],
): Executor {
  return {
    execute(statement) {
      if (typeof statement === "string") return executor.execute(statement);
      const query = new PgDialect().sqlToQuery(statement.getSQL());
      if (!query.sql.includes("with expired as materialized"))
        return executor.execute(statement);
      const scoped = query.sql.replace(
        "where expires_at <=",
        "where organization_id in (__owned__) and expires_at <=",
      );
      if (scoped === query.sql)
        throw new Error("Quota cleanup ownership filter unavailable");
      const chunks = scoped.split(/(\$\d+|__owned__)/g).map((part) =>
        part === "__owned__"
          ? sql.join(
              organizationIds.map((id) => sql`${id}`),
              sql.raw(", "),
            )
          : /^\$\d+$/.test(part)
            ? sql`${query.params[Number(part.slice(1)) - 1]}`
            : sql.raw(part),
      );
      return executor.execute(sql.join(chunks, sql.raw("")));
    },
  };
}
