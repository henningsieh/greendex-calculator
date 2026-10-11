/** Derives a Better Auth Organization slug from a display name. */
export function slugifyOrganizationName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
