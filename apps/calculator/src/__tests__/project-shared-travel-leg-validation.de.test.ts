import {
  DISTANCE_KM_STEP,
  MAX_DISTANCE_KM,
  MIN_DISTANCE_KM,
} from "@greendex/config/project-shared-travel";
import { projectSharedTravelLegsTable } from "@greendex/database/schema";
import { createTranslator } from "@greendex/i18n/client";
import { createInsertSchema } from "drizzle-zod";
import { describe, expect, it } from "vitest";

import {
  createProjectSharedTravelLegDistanceSchema,
  isMultipleOfDistanceStep,
  validateDistanceStep,
} from "@/features/project-shared-travel-legs/distance-validation";
import { ProjectSharedTravelLegFormSchema } from "@/features/project-shared-travel-legs/validation-schemas";
import deMessages from "@/messages/de.json";

/**
 * Create real next-intl translator for German
 * No namespace needed - validation schemas use full paths like
 * "project.shared-travel.form.validation.distanceKm.min"
 */
const tDe = createTranslator({
  locale: "de",
  messages: deMessages,
});

describe("Distance Constants", () => {
  it("should have correct constant values", () => {
    expect(MIN_DISTANCE_KM).toBe(0.1);
    expect(MAX_DISTANCE_KM).toBe(6000);
    expect(DISTANCE_KM_STEP).toBe(0.1);
  });

  describe("isMultipleOfDistanceStep", () => {
    it("should validate correct multiples of 0.1", () => {
      expect(isMultipleOfDistanceStep(0.1)).toBe(true);
      expect(isMultipleOfDistanceStep(0.2)).toBe(true);
      expect(isMultipleOfDistanceStep(0.5)).toBe(true);
      expect(isMultipleOfDistanceStep(1.0)).toBe(true);
      expect(isMultipleOfDistanceStep(1.5)).toBe(true);
      expect(isMultipleOfDistanceStep(10.3)).toBe(true);
      expect(isMultipleOfDistanceStep(100.0)).toBe(true);
    });

    it("should reject invalid multiples", () => {
      expect(isMultipleOfDistanceStep(0.15)).toBe(false);
      expect(isMultipleOfDistanceStep(0.05)).toBe(false);
      expect(isMultipleOfDistanceStep(1.25)).toBe(false);
      expect(isMultipleOfDistanceStep(10.33)).toBe(false);
      expect(isMultipleOfDistanceStep(0.001)).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(isMultipleOfDistanceStep(0)).toBe(true); // 0 is a multiple of 0.1
      expect(isMultipleOfDistanceStep(0.0)).toBe(true);
    });
  });

  describe("validateDistanceStep", () => {
    it("should validate correct step values", () => {
      expect(validateDistanceStep(0.1)).toBe(true);
      expect(validateDistanceStep(1.5)).toBe(true);
      expect(validateDistanceStep(10.0)).toBe(true);
    });

    it("should reject incorrect step values", () => {
      expect(validateDistanceStep(0.15)).toBe(false);
      expect(validateDistanceStep(1.25)).toBe(false);
    });
  });
});

describe("Distance Schema Factory", () => {
  it("should create non-optional schema by default", () => {
    const schema = createProjectSharedTravelLegDistanceSchema(tDe);
    expect(schema.safeParse(undefined).success).toBe(false);
  });

  it("should create optional schema when requested", () => {
    const schema = createProjectSharedTravelLegDistanceSchema(tDe, true);
    expect(schema.safeParse(undefined).success).toBe(true);
  });

  it("should apply consistent validation rules", () => {
    const schema = createProjectSharedTravelLegDistanceSchema(tDe);
    expect(schema.safeParse(0.05).success).toBe(false); // below min
    expect(schema.safeParse(0.1).success).toBe(true); // valid min
    expect(schema.safeParse(0.15).success).toBe(false); // wrong step
    expect(schema.safeParse(0.5).success).toBe(true); // valid mid-range
    expect(schema.safeParse(6000).success).toBe(true); // valid max
    expect(schema.safeParse(6000.1).success).toBe(false); // above max
  });

  it("should return i18n translated error messages", () => {
    const schema = createProjectSharedTravelLegDistanceSchema(tDe);
    const resultMin = schema.safeParse(0.05);
    const resultStep = schema.safeParse(0.15);
    const resultMax = schema.safeParse(6000.1);

    expect(resultMin.success).toBe(false);
    if (!resultMin.success) {
      expect(resultMin.error.issues.length).toBeGreaterThan(0);
      expect(resultMin.error.issues[0].message).toContain(
        "Entfernung muss mindestens",
      );
    }

    expect(resultStep.success).toBe(false);
    if (!resultStep.success) {
      expect(resultStep.error.issues.length).toBeGreaterThan(0);
      expect(resultStep.error.issues[0].message).toContain("Schritten");
    }

    expect(resultMax.success).toBe(false);
    if (!resultMax.success) {
      expect(resultMax.error.issues.length).toBeGreaterThan(0);
      expect(resultMax.error.issues[0].message).toContain("überschreiten");
    }
  });
});

describe("i18n Translation Integration", () => {
  it("should use correct translation messages for German", () => {
    const schema = createProjectSharedTravelLegDistanceSchema(tDe);
    const resultMin = schema.safeParse(0.05);

    expect(resultMin.success).toBe(false);
    if (!resultMin.success) {
      expect(resultMin.error.issues[0].message).toBe(
        "Die Entfernung muss mindestens 0.1 km betragen",
      );
    }
  });

  it("should translate max distance errors for German", () => {
    const schema = createProjectSharedTravelLegDistanceSchema(tDe);
    const resultMax = schema.safeParse(6000.1);

    expect(resultMax.success).toBe(false);
    if (!resultMax.success) {
      expect(resultMax.error.issues[0].message).toBe(
        "Die Entfernung darf 6000 km nicht überschreiten",
      );
    }
  });

  it("should translate step errors for German", () => {
    const schema = createProjectSharedTravelLegDistanceSchema(tDe);
    const resultStep = schema.safeParse(0.15);

    expect(resultStep.success).toBe(false);
    if (!resultStep.success) {
      expect(resultStep.error.issues[0].message).toBe(
        "Die Entfernung muss in Schritten von 0.1 km angegeben werden",
      );
    }
  });

  it("should translate parameters in German messages", () => {
    const schema = createProjectSharedTravelLegDistanceSchema(tDe);
    const resultMin = schema.safeParse(0.05);

    expect(resultMin.success).toBe(false);
    if (!resultMin.success) {
      expect(resultMin.error.issues.length).toBeGreaterThan(0);
      expect(resultMin.error.issues[0].message).toBe(
        "Die Entfernung muss mindestens 0.1 km betragen",
      );
    }
  });
});

describe("Floating-Point Edge Cases", () => {
  it("should handle values close to step boundaries", () => {
    expect(isMultipleOfDistanceStep(0.09999999)).toBe(false);
    // Note: 0.10000001 is too close to 0.1 and may pass due to epsilon tolerance
    expect(isMultipleOfDistanceStep(0.1)).toBe(true);
    expect(isMultipleOfDistanceStep(0.2)).toBe(true);
  });

  it("should validate very large numbers", () => {
    expect(validateDistanceStep(999999999.9)).toBe(true);
    expect(validateDistanceStep(999999999.5)).toBe(true);
  });

  it("should handle min/max boundaries correctly", () => {
    const schema = createProjectSharedTravelLegDistanceSchema(tDe);

    // Test exact boundaries
    expect(schema.safeParse(MIN_DISTANCE_KM).success).toBe(true); // 0.1
    expect(schema.safeParse(MAX_DISTANCE_KM).success).toBe(true); // 6000

    // Test values clearly outside boundaries
    expect(schema.safeParse(0.09).success).toBe(false); // below min
    expect(schema.safeParse(6000.2).success).toBe(false); // above max
  });

  it("should handle floating point arithmetic correctly", () => {
    const schema = createProjectSharedTravelLegDistanceSchema(tDe);

    // Test common floating point problematic values
    expect(schema.safeParse(0.3).success).toBe(true); // 0.1 + 0.1 + 0.1
    expect(schema.safeParse(1.1).success).toBe(true); // 1.0 + 0.1
    expect(schema.safeParse(2.2).success).toBe(true); // 2.0 + 0.2
  });
});

describe("Distance Validation Schemas", () => {
  // Base Drizzle schema for testing (type validation only, no custom messages)
  const BaseCreateProjectSharedTravelLegSchema = createInsertSchema(
    projectSharedTravelLegsTable,
  ).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

  describe("Base Create Project Shared Travel Leg Schema (Type Validation)", () => {
    it("should accept valid distance values", () => {
      const validData = {
        projectId: "test-project",
        transportEmissionProfile: "car" as const,
        distanceKm: 0.1,
        description: null,
        travelDate: null,
      };

      const result = BaseCreateProjectSharedTravelLegSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should accept distances that are multiples of 0.1", () => {
      const testCases = [0.1, 0.5, 1.0, 5.5, 10.3, 100.0];

      for (const distance of testCases) {
        const data = {
          projectId: "test-project",
          transportEmissionProfile: "car" as const,
          distanceKm: distance,
          description: null,
          travelDate: null,
        };

        const result = BaseCreateProjectSharedTravelLegSchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it("should accept large distances within max", () => {
      const data = {
        projectId: "test-project",
        transportEmissionProfile: "car" as const,
        distanceKm: 5999.9,
        description: null,
        travelDate: null,
      };

      const result = BaseCreateProjectSharedTravelLegSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should accept number type for distanceKm", () => {
      const data = {
        projectId: "test-project",
        transportEmissionProfile: "car" as const,
        distanceKm: 100,
        description: null,
        travelDate: null,
      };

      const result = BaseCreateProjectSharedTravelLegSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("Project Shared Travel Leg Form Schema (Batch Operations)", () => {
    it("accepts valid distance values for a Project Shared Travel Leg", () => {
      const validData = {
        id: "test-id",
        projectId: "test-project-id",
        transportEmissionProfile: "bus" as const,
        distanceKm: 5.5,
        description: "Test shared travel leg",
        travelDate: new Date(),
        isNew: false,
        isDeleted: false,
      };

      const result = ProjectSharedTravelLegFormSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should accept number type for distanceKm", () => {
      const validData = {
        id: "test-id",
        projectId: "test-project-id",
        transportEmissionProfile: "train" as const,
        distanceKm: 100.5,
        description: "Test shared travel leg",
        travelDate: new Date(),
        isNew: false,
        isDeleted: false,
      };

      const result = ProjectSharedTravelLegFormSchema.safeParse(validData);

      expect(result.success).toBe(true);
    });
  });
});
