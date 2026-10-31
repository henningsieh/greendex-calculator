import { z } from "zod";

export const CoordinationIdSchema = z.string().trim().min(1).max(128);
