import { db } from "@greendex/database";
import {
  projectSharedTravelLegsTable,
  projectsTable,
} from "@greendex/database/schema";
import { openapi } from "@orpc/openapi";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { authorized, requireProjectPermissions } from "@/lib/orpc/middleware";

import type {
  CreateProjectSharedTravelLegInput,
  DeleteProjectSharedTravelLegInput,
  UpdateProjectSharedTravelLegInput,
} from "./types";
import {
  CreateProjectSharedTravelLegInputSchema,
  DeleteProjectSharedTravelLegInputSchema,
  ListProjectSharedTravelLegsInputSchema,
  ProjectSharedTravelLegWithRelationsSchema,
  UpdateProjectSharedTravelLegInputSchema,
} from "./validation-schemas";

type ProcedureContext = {
  session: {
    activeOrganizationId?: string | null;
  };
};

type ErrorFactory = (options: { message: string }) => Error;

type ProcedureErrors = {
  BAD_REQUEST: ErrorFactory;
  FORBIDDEN: ErrorFactory;
  INTERNAL_SERVER_ERROR: ErrorFactory;
  NOT_FOUND: ErrorFactory;
};

function requireActiveOrganization(
  context: ProcedureContext,
  errors: ProcedureErrors,
): string {
  const organizationId = context.session.activeOrganizationId;
  if (!organizationId) {
    throw errors.BAD_REQUEST({
      message: "No active organization. Please select an organization first.",
    });
  }

  return organizationId;
}

async function verifyProjectAccess(
  projectId: string,
  organizationId: string,
): Promise<boolean> {
  const project = await db.query.projectsTable.findFirst({
    where: { id: projectId, organizationId },
    columns: { id: true },
  });

  return project !== undefined;
}

async function assertProjectAccess(
  projectId: string,
  context: ProcedureContext,
  errors: ProcedureErrors,
): Promise<void> {
  const organizationId = requireActiveOrganization(context, errors);
  if (!(await verifyProjectAccess(projectId, organizationId))) {
    throw errors.FORBIDDEN({
      message: "You don't have access to this project",
    });
  }
}

async function assertTravelLegAccess(
  input: { id: string; projectId?: string },
  operation: "update" | "delete",
  context: ProcedureContext,
  errors: ProcedureErrors,
): Promise<void> {
  const organizationId = requireActiveOrganization(context, errors);
  const [existingTravelLeg] = await db
    .select({
      projectOrganizationId: projectsTable.organizationId,
    })
    .from(projectSharedTravelLegsTable)
    .innerJoin(
      projectsTable,
      eq(projectSharedTravelLegsTable.projectId, projectsTable.id),
    )
    .where(
      and(
        eq(projectSharedTravelLegsTable.id, input.id),
        input.projectId
          ? eq(projectSharedTravelLegsTable.projectId, input.projectId)
          : undefined,
      ),
    )
    .limit(1);

  if (!existingTravelLeg) {
    throw errors.NOT_FOUND({
      message: "Project Shared Travel Leg not found",
    });
  }
  if (existingTravelLeg.projectOrganizationId !== organizationId) {
    throw errors.FORBIDDEN({
      message: `You don't have permission to ${operation} this shared travel leg`,
    });
  }
}

export async function listProjectSharedTravelLegsHandler(
  input: { projectId: string },
  context: ProcedureContext,
  errors: ProcedureErrors,
) {
  await assertProjectAccess(input.projectId, context, errors);

  const travelLegs = await db.query.projectSharedTravelLegsTable.findMany({
    where: { projectId: input.projectId },
    orderBy: { createdAt: "asc" },
    with: { project: true },
  });

  return travelLegs;
}

export async function createProjectSharedTravelLegHandler(
  input: CreateProjectSharedTravelLegInput,
  context: ProcedureContext,
  errors: ProcedureErrors,
) {
  await assertProjectAccess(input.projectId, context, errors);

  const [createdTravelLeg] = await db
    .insert(projectSharedTravelLegsTable)
    .values({
      projectId: input.projectId,
      transportEmissionProfile: input.transportEmissionProfile,
      distanceKm: input.distanceKm,
      description: input.description,
      travelDate: input.travelDate,
    })
    .returning({ id: projectSharedTravelLegsTable.id });

  if (!createdTravelLeg) {
    throw errors.INTERNAL_SERVER_ERROR({
      message: "Failed to create Project Shared Travel Leg",
    });
  }

  const travelLegWithRelations =
    await db.query.projectSharedTravelLegsTable.findFirst({
      where: { id: createdTravelLeg.id },
      with: { project: true },
    });

  if (!travelLegWithRelations) {
    throw errors.INTERNAL_SERVER_ERROR({
      message: "Failed to fetch newly created Project Shared Travel Leg",
    });
  }

  return {
    success: true,
    sharedTravelLeg: travelLegWithRelations,
  };
}

export async function updateProjectSharedTravelLegHandler(
  input: Omit<UpdateProjectSharedTravelLegInput, "projectId"> & {
    projectId?: string;
  },
  context: ProcedureContext,
  errors: ProcedureErrors,
) {
  await assertTravelLegAccess(input, "update", context, errors);

  const updateData: Partial<typeof projectSharedTravelLegsTable.$inferInsert> =
    {};
  if (input.data.transportEmissionProfile !== undefined) {
    updateData.transportEmissionProfile = input.data.transportEmissionProfile;
  }
  if (input.data.distanceKm !== undefined) {
    updateData.distanceKm = input.data.distanceKm;
  }
  if (input.data.description !== undefined) {
    updateData.description = input.data.description;
  }
  if (input.data.travelDate !== undefined) {
    updateData.travelDate = input.data.travelDate;
  }

  if (Object.keys(updateData).length > 0) {
    await db
      .update(projectSharedTravelLegsTable)
      .set(updateData)
      .where(eq(projectSharedTravelLegsTable.id, input.id));
  }

  const travelLegWithRelations =
    await db.query.projectSharedTravelLegsTable.findFirst({
      where: { id: input.id },
      with: { project: true },
    });

  if (!travelLegWithRelations) {
    throw errors.INTERNAL_SERVER_ERROR({
      message: "Failed to fetch updated Project Shared Travel Leg",
    });
  }

  return {
    success: true,
    sharedTravelLeg: travelLegWithRelations,
  };
}

export async function deleteProjectSharedTravelLegHandler(
  input: Omit<DeleteProjectSharedTravelLegInput, "projectId"> & {
    projectId?: string;
  },
  context: ProcedureContext,
  errors: ProcedureErrors,
) {
  await assertTravelLegAccess(input, "delete", context, errors);

  await db
    .delete(projectSharedTravelLegsTable)
    .where(eq(projectSharedTravelLegsTable.id, input.id));

  return { success: true };
}

export const listProjectSharedTravelLegs = authorized
  .use(requireProjectPermissions(["read"]))
  .meta(
    openapi({
      method: "GET",
      path: "/projects/{projectId}/shared-travel-legs",
      summary: "List Project Shared Travel Legs",
      tags: ["project", "shared-travel-leg"],
    }),
  )
  .input(ListProjectSharedTravelLegsInputSchema)
  .output(z.array(ProjectSharedTravelLegWithRelationsSchema))
  .handler(({ input, context, errors }) =>
    listProjectSharedTravelLegsHandler(input, context, errors),
  );

const projectSharedTravelLegMutationOutputSchema = z.object({
  success: z.boolean(),
  sharedTravelLeg: ProjectSharedTravelLegWithRelationsSchema,
});

export const createProjectSharedTravelLeg = authorized
  .use(requireProjectPermissions(["update"]))
  .meta(
    openapi({
      method: "POST",
      path: "/projects/{projectId}/shared-travel-legs",
      summary: "Create a Project Shared Travel Leg",
      tags: ["project", "shared-travel-leg"],
    }),
  )
  .input(CreateProjectSharedTravelLegInputSchema)
  .output(projectSharedTravelLegMutationOutputSchema)
  .handler(({ input, context, errors }) =>
    createProjectSharedTravelLegHandler(input, context, errors),
  );

export const updateProjectSharedTravelLeg = authorized
  .use(requireProjectPermissions(["update"]))
  .meta(
    openapi({
      method: "PATCH",
      path: "/projects/{projectId}/shared-travel-legs/{id}",
      summary: "Update a Project Shared Travel Leg",
      tags: ["project", "shared-travel-leg"],
    }),
  )
  .input(UpdateProjectSharedTravelLegInputSchema)
  .output(projectSharedTravelLegMutationOutputSchema)
  .handler(({ input, context, errors }) =>
    updateProjectSharedTravelLegHandler(input, context, errors),
  );

export const deleteProjectSharedTravelLeg = authorized
  .use(requireProjectPermissions(["update"]))
  .meta(
    openapi({
      method: "DELETE",
      path: "/projects/{projectId}/shared-travel-legs/{id}",
      summary: "Delete a Project Shared Travel Leg",
      tags: ["project", "shared-travel-leg"],
    }),
  )
  .input(DeleteProjectSharedTravelLegInputSchema)
  .output(z.object({ success: z.boolean() }))
  .handler(({ input, context, errors }) =>
    deleteProjectSharedTravelLegHandler(input, context, errors),
  );
