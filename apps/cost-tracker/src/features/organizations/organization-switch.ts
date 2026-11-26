"use client";

import { useMutationState } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";

export const organizationSwitchKey = ["organization-switch"] as const;

export function useOrganizationSwitchBlocked() {
  return useMutationState({
    filters: { mutationKey: organizationSwitchKey, exact: true },
    select: ({ state }) => state.status,
  }).some((status) => status === "pending" || status === "success");
}

export function reloadOrganizationPage() {
  window.location.reload();
}

export function useReadyOrganizationContext() {
  const switchBlocked = useOrganizationSwitchBlocked();
  const session = authClient.useSession();
  const organization = authClient.useActiveOrganization();
  if (
    switchBlocked ||
    session.isPending ||
    session.isRefetching ||
    session.error ||
    organization.isPending ||
    organization.isRefetching ||
    organization.error
  )
    return null;

  const userId = session.data?.user.id;
  const active = organization.data;
  if (
    !userId ||
    !active ||
    session.data?.session?.activeOrganizationId !== active.id
  )
    return null;

  return {
    userId,
    organizationId: active.id,
    role: active.members.find((entry) => entry.userId === userId)?.role ?? null,
  };
}
