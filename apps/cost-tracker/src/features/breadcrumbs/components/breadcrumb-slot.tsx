import { getTranslations } from "@greendex/i18n/server";
import { Suspense } from "react";

import BreadcrumbTrail, {
  BreadcrumbTrailFallback,
} from "@/features/breadcrumbs/components/breadcrumb-trail";
import type { ShellMessageKey } from "@/features/breadcrumbs/types";

type BreadcrumbSlotProps =
  | { current: ShellMessageKey; children?: never }
  | { current?: never; children: React.ReactNode };

async function CurrentPageTrail({ current }: { current: ShellMessageKey }) {
  const t = await getTranslations("shell");
  return <BreadcrumbTrail items={[]} current={t(current)} />;
}

/**
 * The App Shell header's breadcrumb slot.
 *
 * Crumbs resolve per request, so every `@breadcrumb` segment declares
 * `export const instant = false`. This component owns the Suspense boundary and
 * its fallback, which lets a slot file name only its page: the `shell` message
 * key of a leaf route, or the async content that resolves nested crumbs.
 */
export function BreadcrumbSlot(props: BreadcrumbSlotProps) {
  return (
    <Suspense fallback={<BreadcrumbTrailFallback />}>
      {props.current ? (
        <CurrentPageTrail current={props.current} />
      ) : (
        props.children
      )}
    </Suspense>
  );
}
