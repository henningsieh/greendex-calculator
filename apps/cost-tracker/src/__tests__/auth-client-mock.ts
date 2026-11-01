import {
  costTrackerOrganizationRoles,
  parseOrganizationRoles,
} from "@greendex/auth/permissions";

type BrowserSession = {
  userId: string;
  activeOrganizationId: string | null;
  role: string | null;
};

type Role =
  (typeof costTrackerOrganizationRoles)[keyof typeof costTrackerOrganizationRoles];
type Permissions = Parameters<Role["authorize"]>[0];

export function createAuthClientMock(session: BrowserSession) {
  return {
    useSession: () => ({ data: { user: { id: session.userId } } }),
    useActiveOrganization: () => ({
      data: session.activeOrganizationId
        ? {
            id: session.activeOrganizationId,
            members: [{ userId: session.userId, role: session.role }],
          }
        : null,
    }),
    organization: {
      // Use the same role definitions as the real Better Auth client.
      checkRolePermission: ({
        role,
        permissions,
      }: {
        role: string;
        permissions: Permissions;
      }) => {
        const names = parseOrganizationRoles(role);
        return names.some(
          (name) =>
            costTrackerOrganizationRoles[name].authorize(permissions).success,
        );
      },
    },
  };
}
