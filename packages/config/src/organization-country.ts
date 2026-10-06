import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";

export const organizationAdditionalFields = {
  country: { type: EU_COUNTRY_CODES, required: true },
} as const;
