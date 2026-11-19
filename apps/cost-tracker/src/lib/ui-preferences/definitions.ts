export const preferenceOptions = {
  path: "/",
  sameSite: "Lax",
  secureOnHttps: true,
  maxAge: 60 * 60 * 24 * 7,
} as const;

export type Preference<T> = {
  name: string;
  defaultValue: T;
  parse: (value: string | undefined) => T;
  serialize: (value: T) => string;
};

export const sidebarPreference: Preference<boolean> = {
  name: "sidebar_state",
  defaultValue: true,
  parse: (value) => value !== "false",
  serialize: String,
};

export const projectVisibilityColumns = [
  "startDate",
  "endDate",
  "settlement",
  "location",
  "participants",
] as const;
export type ProjectVisibility = Partial<
  Record<(typeof projectVisibilityColumns)[number], false>
>;

export function projectVisibilityPreference(
  accountKey: string,
): Preference<ProjectVisibility> {
  return {
    name: `project_columns_${accountKey}`,
    defaultValue: {},
    parse(value) {
      if (!value || value.length > 256) return {};
      try {
        const parsed: unknown = JSON.parse(value);
        if (
          !Array.isArray(parsed) ||
          parsed[0] !== 1 ||
          !Array.isArray(parsed[1])
        )
          return {};
        if (
          parsed.length !== 2 ||
          parsed[1].some(
            (id: unknown) =>
              !projectVisibilityColumns.some((supported) => supported === id),
          )
        )
          return {};
        return Object.fromEntries(parsed[1].map((id: string) => [id, false]));
      } catch {
        return {};
      }
    },
    serialize(value) {
      return JSON.stringify([
        1,
        projectVisibilityColumns.filter((id) => value[id] === false),
      ]);
    },
  };
}
