import type { z } from "zod";

import type { EditNameSchema } from "@/features/user-settings/validation-schemas";

export type EditNameValues = z.infer<typeof EditNameSchema>;
