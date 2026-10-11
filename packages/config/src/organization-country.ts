import { EU_COUNTRY_CODES } from "./eu-countries";

/** Shared supported Better Auth additionalFields configuration for both apps. */
export const organizationCountryFields = {
  country: {
    type: EU_COUNTRY_CODES,
    required: true,
  },
} as const;
