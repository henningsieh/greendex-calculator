import {
  MAX_DISTANCE_KM,
  MIN_DISTANCE_KM,
} from "@greendex/config/project-shared-travel";
import { PROJECT_SHARED_TRANSPORT_EMISSION_PROFILES } from "@greendex/config/transport-emission-profiles";
import {
  projectSharedTravelLegsTable,
  projectsTable,
} from "@greendex/database/schema";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";

import { validateDistanceStep } from "./distance-validation";

const persistedInsertSchema = createInsertSchema(projectSharedTravelLegsTable);
const persistedSelectSchema = createSelectSchema(projectSharedTravelLegsTable);
const persistedUpdateSchema = createUpdateSchema(projectSharedTravelLegsTable);

export const TransportEmissionProfileSchema = z.enum(
  PROJECT_SHARED_TRANSPORT_EMISSION_PROFILES,
);

const distanceKmSchema = z
  .number()
  .min(MIN_DISTANCE_KM)
  .max(MAX_DISTANCE_KM)
  .refine(validateDistanceStep, {
    message: "Distance must use increments of 0.1 km",
  });

/** Standard persisted contract derived from the Drizzle model. */
export const ProjectSharedTravelLegSchema = z.object({
  id: persistedSelectSchema.shape.id,
  projectId: persistedSelectSchema.shape.projectId,
  transportEmissionProfile: TransportEmissionProfileSchema,
  distanceKm: persistedSelectSchema.shape.distanceKm,
  description: persistedSelectSchema.shape.description,
  travelDate: persistedSelectSchema.shape.travelDate,
  createdAt: persistedSelectSchema.shape.createdAt,
  updatedAt: persistedSelectSchema.shape.updatedAt,
});

export const ProjectSharedTravelLegWithRelationsSchema =
  ProjectSharedTravelLegSchema.extend({
    project: createSelectSchema(projectsTable),
  });

export const ListProjectSharedTravelLegsInputSchema = z.object({
  projectId: z.string(),
});

export const CreateProjectSharedTravelLegInputSchema = z.object({
  projectId: persistedInsertSchema.shape.projectId,
  transportEmissionProfile: TransportEmissionProfileSchema,
  distanceKm: distanceKmSchema,
  description: persistedInsertSchema.shape.description,
  travelDate: persistedInsertSchema.shape.travelDate,
});

export const ProjectSharedTravelLegFormSchema =
  CreateProjectSharedTravelLegInputSchema.omit({ projectId: true });

const projectSharedTravelLegUpdateSchema = z.object({
  transportEmissionProfile: TransportEmissionProfileSchema.optional(),
  distanceKm: distanceKmSchema.optional(),
  description: persistedUpdateSchema.shape.description,
  travelDate: persistedUpdateSchema.shape.travelDate,
});

export const UpdateProjectSharedTravelLegInputSchema = z.object({
  projectId: persistedSelectSchema.shape.projectId,
  id: persistedSelectSchema.shape.id,
  data: projectSharedTravelLegUpdateSchema,
});

export const DeleteProjectSharedTravelLegInputSchema = z.object({
  projectId: persistedSelectSchema.shape.projectId,
  id: persistedSelectSchema.shape.id,
});
