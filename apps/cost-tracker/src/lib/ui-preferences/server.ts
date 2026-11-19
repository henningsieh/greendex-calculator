import "server-only";
import { createHash } from "node:crypto";

import { cookies } from "next/headers";

import {
  projectVisibilityPreference,
  sidebarPreference,
  type Preference,
} from "@/lib/ui-preferences/definitions";

async function readPreference<T>(preference: Preference<T>): Promise<T> {
  try {
    return preference.parse((await cookies()).get(preference.name)?.value);
  } catch {
    return preference.defaultValue;
  }
}

export function readSidebarPreference() {
  return readPreference(sidebarPreference);
}

export async function readProjectVisibility(userId: string) {
  const accountKey = createHash("sha256")
    .update(userId)
    .digest("hex")
    .slice(0, 32);
  return {
    accountKey,
    visibility: await readPreference(projectVisibilityPreference(accountKey)),
  };
}
