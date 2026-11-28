import "server-only";
import { claimPaidNotificationIntent } from "@/features/claims/procedures/payment-notification";
import type { NotificationIntent } from "@/features/notifications/procedures/actions";
import { declareNotifications } from "@/features/notifications/procedures/actions";

type ProcedureMarker = { "~orpc": unknown };

type IsProcedure<T> = T extends ProcedureMarker ? true : false;

/**
 * Every router entry must appear here: a typed intent for an action that emits
 * a notification event, or explicit `null` for an action that emits nothing.
 * A missing, renamed, or extra router entry fails type checking.
 */
export type NotificationDeclarationTree<TRouter> = {
  [K in keyof TRouter]: IsProcedure<TRouter[K]> extends true
    ? NotificationIntent<never> | null
    : TRouter[K] extends object
      ? NotificationDeclarationTree<TRouter[K]>
      : never;
};

function isProcedure(value: unknown): value is ProcedureMarker {
  return typeof value === "object" && value !== null && "~orpc" in value;
}

function isGroup(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function attach<T extends object>(
  node: T,
  declarations: NotificationDeclarationTree<T>,
  path: string[],
): void {
  const declarationRecord = declarations as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(node)) {
    const declaration = declarationRecord[key];
    const location = [...path, key].join(".");
    if (declaration === undefined)
      throw new Error(`Missing notification declaration at ${location}.`);
    if (isProcedure(value)) {
      declareNotifications(
        value,
        declaration as NotificationIntent<never> | null,
      );
      continue;
    }
    if (!isGroup(value) || !isGroup(declaration))
      throw new Error(`Invalid notification declaration at ${location}.`);
    attach(value, declaration as NotificationDeclarationTree<object>, [
      ...path,
      key,
    ]);
  }
}

/**
 * Attaches the declared intent to each procedure object before the router is
 * exported. The declaration tree is the single complete inventory; the
 * comparison with the actual router shape is enforced by the function's type.
 */
export function attachNotificationDeclarations<TRouter extends object>(
  router: TRouter,
  declarations: NotificationDeclarationTree<TRouter>,
): TRouter {
  attach(router, declarations, []);
  return router;
}

/**
 * Cost Tracker v1: only recording a full Claim payment emits. Every other
 * action declares null until a later event earns a real intent.
 */
export const notificationDeclarationTree = {
  authentication: {
    createOrganization: null,
    onboardingNextStep: null,
    signIn: null,
    signOut: null,
    signUp: null,
    startGoogleSignIn: null,
    updateUser: null,
  },
  participantOnboarding: {
    acceptAgreement: null,
    saveProfile: null,
    createRegistrationLink: null,
    setRegistrationLinkOpen: null,
    issueInvitation: null,
    reissueInvitation: null,
    setInvitationOpen: null,
    join: null,
    listMyProjects: null,
  },
  notifications: {
    listUnread: null,
    markRead: null,
    markAllRead: null,
  },
  participations: {
    create: null,
    searchOnboarded: null,
    get: null,
    listPartnership: null,
    listHosted: null,
    listHostedReport: null,
    listMine: null,
    update: null,
    remove: null,
    listOnboardingProgress: null,
  },
  duplicateReviews: {
    list: null,
    assign: null,
    resolve: null,
  },
  claims: {
    getDraft: null,
    createPayoutAccount: null,
    listPayoutAccounts: null,
    saveDraft: null,
    selectPayoutAccount: null,
    submit: null,
    previewSubmission: null,
    getHistory: null,
    getReviewDetails: null,
    reviewerAccess: null,
    requestCorrection: null,
    approve: null,
    markPaid: claimPaidNotificationIntent,
    correctPayment: null,
    reject: null,
    reopen: null,
    listReviewQueue: null,
  },
  costs: {
    list: null,
    save: null,
    linkDocument: null,
  },
  documents: {
    list: null,
  },
  journeys: {
    list: null,
    save: null,
    update: null,
  },
  organizations: {
    getSettings: null,
    updateCountry: null,
    search: null,
    listOptions: null,
    listMine: null,
    listMemberships: null,
    listMembers: null,
    listPendingInvitations: null,
    inviteMember: null,
    acceptInvitation: null,
    rejectInvitation: null,
    cancelInvitation: null,
  },
  projects: {
    create: null,
    archive: null,
    reopen: null,
    searchHosted: null,
    listHostedOptions: null,
    get: null,
    listHosted: null,
    listPartner: null,
    scopes: null,
  },
  projectPartnerships: {
    assign: null,
    list: null,
    remove: null,
    getScope: null,
    createSetupLink: null,
    listSetupLinks: null,
    disableSetupLink: null,
    getSetupLinkEligibility: null,
    consumeSetupLink: null,
    assignPartnerCoordinator: null,
    removePartnerCoordinator: null,
  },
} satisfies Record<string, Record<string, NotificationIntent<never> | null>>;
