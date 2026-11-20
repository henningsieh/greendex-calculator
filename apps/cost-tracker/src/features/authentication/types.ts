import type { user } from "@greendex/database/schema";

export type UserSummary = Pick<typeof user.$inferSelect, "email" | "name">;
