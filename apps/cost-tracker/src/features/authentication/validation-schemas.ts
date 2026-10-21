import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import { z } from "zod";

export const CreateOrganizationInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(120),
  country: z.enum(EU_COUNTRY_CODES),
});
