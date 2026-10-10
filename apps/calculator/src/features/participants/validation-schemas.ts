import {
  participantJourneysTable,
  projectParticipantsTable,
  user as userTable,
} from "@greendex/database/schema";
import { createSelectSchema } from "drizzle-zod";

// Schema for participant with user details (as returned by the API)
export const ProjectParticipantWithUserSchema = createSelectSchema(
  projectParticipantsTable,
).extend({
  journey: createSelectSchema(participantJourneysTable).nullable(),
  user: createSelectSchema(userTable)
    .omit({
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    })
    .nullable(),
});

// Schema for UI participant display - flattens user fields for easier access
export const ParticipantSchema = createSelectSchema(
  projectParticipantsTable,
).extend({
  name: createSelectSchema(userTable).shape.name,
  // Note: country is already in projectParticipantsTable, no need to extend
});
