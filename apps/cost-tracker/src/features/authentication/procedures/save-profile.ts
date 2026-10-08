import "server-only";
import { db } from "@greendex/database";
import { participantProfilesTable as profiles } from "@greendex/database/schema";

import {
  profileInput,
  success,
} from "@/features/authentication/procedures/shared";
import { authorized } from "@/lib/orpc/middleware";

export function buildSaveProfile() {
  const saveProfile = authorized
    .input(profileInput)
    .output(success)
    .handler(async ({ context, input }) => {
      await db
        .insert(profiles)
        .values({ userId: context.user.id, fullName: input.fullName })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: { fullName: input.fullName, updatedAt: new Date() },
        });
      return { success: true as const };
    });
  return saveProfile;
}
