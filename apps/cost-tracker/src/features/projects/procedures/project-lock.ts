import { db } from "@greendex/database";
import { projectsTable as projects } from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";

import {
  createSituationErrors,
  type ScopeErrorConstructors,
} from "@/lib/orpc/errors";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function lockActiveProject(
  tx: Transaction,
  projectId: string,
  errors: ScopeErrorConstructors,
) {
  const [project] = await tx
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.costTrackerArchived, false)),
    )
    .for("update")
    .limit(1);
  if (!project) throw createSituationErrors(errors).projectNotFound();
  return project;
}
