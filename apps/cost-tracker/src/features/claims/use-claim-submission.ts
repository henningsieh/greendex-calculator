import { useTranslations } from "@greendex/i18n/client";
import { useRef, useState } from "react";

import { toast } from "@/components/ui/toast";
import { canSubmitClaim } from "@/features/claims/claim-submission-policy";
import { orpc } from "@/lib/orpc/orpc";

export function useClaimSubmission(
  partnershipId: string,
  action: Parameters<typeof canSubmitClaim>[0],
  preview: Parameters<typeof canSubmitClaim>[1],
  refresh: () => Promise<void>,
) {
  const t = useTranslations("claims.submission");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const saving = useRef(false);
  const ready = canSubmitClaim(action, preview);

  async function submit() {
    if (!ready || !confirming || saving.current) return;
    saving.current = true;
    setPending(true);
    setFailure(null);
    try {
      await orpc.claims.submit({ partnershipId });
      await refresh();
      toast.add({ title: t("toast.submitted"), type: "success" });
    } catch (error) {
      setConfirming(false);
      setFailure({ error });
      toast.add({ title: t("toast.submitFailed"), type: "error" });
      await refresh();
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return {
    confirming,
    pending,
    disabled: !ready || pending,
    failure,
    open: () => setConfirming(true),
    cancel: () => setConfirming(false),
    submit,
  };
}
