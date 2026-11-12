import { IDENTIFIER_MAX_LENGTH, user } from "@greendex/database/schema";
import { createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

const USER_NAME_MAX_LENGTH = 80;

export const EditNameSchema = createUpdateSchema(user, {
  name: z
    .string()
    .trim()
    .min(2, { error: "Enter at least 2 characters." })
    .max(USER_NAME_MAX_LENGTH, {
      error: `Enter no more than ${USER_NAME_MAX_LENGTH} characters.`,
    }),
})
  .pick({ name: true })
  .required();

export const UserIdSchema = createSelectSchema(user)
  .shape.id.trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);
