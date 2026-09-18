/* eslint-disable shadcn/no-restyle -- This composed control intentionally owns its dense link styling. */
"use client";

import { useTranslations } from "@greendex/i18n/client";
import { CopyIcon, ExternalLinkIcon, Link2Icon, QrCodeIcon } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { env } from "@/env";

interface ParticipationControlsClientProps {
  projectId: string;
}

/**
 * Render controls for sharing a project's participation link, including copy, open-in-new-tab, and a QR code modal.
 *
 * @param projectId - The project's identifier used to construct the participation URL.
 * @returns A card containing the participation URL input, copy/open actions, and a QR code modal
 */
export function ParticipantsLinkControls({
  projectId,
}: ParticipationControlsClientProps) {
  const t = useTranslations("organization.projects.activeProject");
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // Generate participation URL
  const participationUrl = projectId
    ? `${env.NEXT_PUBLIC_BASE_URL}/project/${projectId}/participate`
    : "";

  // Input ref to focus & select URL for easy copying
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Helper function to select URL text and scroll to start
  const selectUrlText = useCallback(
    (input: HTMLInputElement) => {
      input.setSelectionRange(0, participationUrl.length);
      requestAnimationFrame(() => {
        input.scrollLeft = 0;
      });
    },
    [participationUrl],
  );

  // Auto-focus and select the URL when it's available
  useEffect(() => {
    const input = inputRef.current;
    if (participationUrl && input) {
      // focus without scrolling the page
      input.focus?.({ preventScroll: true });
      selectUrlText(input);
    }
  }, [participationUrl, selectUrlText]);

  // Generate QR code when modal opens
  useEffect(() => {
    if (isQrModalOpen && participationUrl) {
      QRCode.toDataURL(participationUrl, {
        width: 300,
        margin: 2,
      })
        .then((url) => {
          setQrCodeDataUrl(url);
        })
        .catch((err) => {
          console.error("Error generating QR code:", err);
          toast.error(t("participation.qrError"));
        });
    }
  }, [isQrModalOpen, participationUrl, t]);

  if (!projectId) {
    return null;
  }

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(participationUrl)
      .then(() => toast.success(t("participation.copySuccess")))
      .catch(() => toast.error(t("participation.copyFailure")));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2Icon className="size-5 text-secondary" />
          {t("participation.title")}
        </CardTitle>
        <CardDescription>{t("participation.description")}</CardDescription>

        <CardAction>
          {/* QR Code Modal */}
          <Dialog onOpenChange={setIsQrModalOpen} open={isQrModalOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => setIsQrModalOpen(true)}
                variant="secondaryoutline"
              >
                <QrCodeIcon className="size-6" />
                <span className="hidden sm:inline">
                  {t("participation.qrButtonLabel")}
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent
              className="border-secondary/70"
              showCloseButton={false}
            >
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-secondary-foreground sm:text-3xl">
                  {t("participation.modalTitle")}
                </DialogTitle>
                <DialogDescription className="text-base text-secondary-foreground/60 sm:text-lg">
                  {t("participation.modalDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                {qrCodeDataUrl ? (
                  <div
                    aria-label={t("participation.modalTitle")}
                    className="size-75 rounded-lg border border-secondary/70 bg-contain bg-center bg-no-repeat"
                    role="img"
                    style={{ backgroundImage: `url(${qrCodeDataUrl})` }}
                  />
                ) : (
                  <div className="flex size-75 items-center justify-center rounded-lg border border-secondary/70">
                    <div className="size-8 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
                  </div>
                )}
                <p className="text-center font-mono text-xs break-all text-muted-foreground">
                  {participationUrl}
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="mt-6 flex flex-wrap gap-3">
          <InputGroup className="flex-1 border border-secondary/30 bg-background has-[[data-slot=input-group-control]:focus-visible]:border-secondary has-[[data-slot=input-group-control]:focus-visible]:ring-secondary/40">
            <InputGroupInput
              className="truncate border-0 font-mono text-sm text-muted-foreground selection:bg-secondary selection:text-secondary-foreground"
              onFocus={(e) => {
                selectUrlText(e.currentTarget);
              }}
              readOnly
              ref={inputRef}
              title={t("participation.linkLabel")}
              type="text"
              value={participationUrl}
            />
            <InputGroupAddon>
              <InputGroupButton
                aria-label={t("participation.copyClipboard")}
                className="rounded-sm text-secondary"
                onClick={copyToClipboard}
                size="icon-xs"
                title={t("participation.copyClipboard")}
                variant="secondaryghost"
              >
                <CopyIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>

          {/* Button open link external */}
          <Button asChild className="sm:w-36" size="icon" variant="secondary">
            <a
              className="flex items-center gap-2"
              href={participationUrl}
              rel={"noopener noreferrer"}
              target="_blank"
            >
              <ExternalLinkIcon className="size-5" />
              <span className="hidden sm:inline">
                {t("participation.openLink")}
              </span>
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// UNUSED: ParticipationControlsClientSkeleton
// export function ParticipationControlsClientSkeleton() {
//   return (
//     <Card className="p-4 mb-8 space-y-4 border border-secondary/70 bg-secondary/10">
//       <div className="flex justify-between items-center">
//         <div className="flex gap-2 items-center mb-4">
//           <div className="rounded size-5 bg-muted" />
//           <div className="w-48 h-6 rounded bg-muted" />
//         </div>
//         <div className="w-32 h-8 rounded bg-muted" />
//       </div>
//       <div className="w-full h-4 rounded bg-muted" />
//       <div className="w-5/6 h-4 rounded bg-muted" />
//       <div className="flex flex-wrap gap-2 mt-6">
//         <div className="flex-1 h-10 rounded bg-muted" />
//         <div className="w-32 h-10 rounded bg-muted" />
//       </div>
//     </Card>
//   );
// }
