import { organization } from "@greendex/database/schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const OrganizationOptionSchema = createSelectSchema(organization).pick({
  id: true,
  name: true,
});
export type OrganizationOption = z.infer<typeof OrganizationOptionSchema>;
