import { organization } from "@greendex/database/schema";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const organizationColumns = createInsertSchema(organization);

export const CreateOrganizationInputSchema = z.object({
  name: organizationColumns.shape.name.trim().min(2).max(100),
  slug: organizationColumns.shape.slug.trim().min(2).max(120),
  country: organizationColumns.shape.country,
});
