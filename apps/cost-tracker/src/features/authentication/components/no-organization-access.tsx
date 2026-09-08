"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Building2Icon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import { authClient } from "@/lib/auth-client";

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function NoOrganizationAccess({ autoOpen }: { autoOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function createOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);

    const result = await authClient.organization.create({
      name,
      slug: slugify(name),
    });

    if (result.error) {
      setPending(false);
      setError("Choose a different Organization name.");
      return;
    }

    setOpen(false);
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl items-center px-5 py-10 sm:px-8">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2Icon />
          </EmptyMedia>
          <EmptyTitle>No Organization access yet</EmptyTitle>
          <EmptyDescription>
            Create your Organization to host Projects, or wait for an invitation
            from an Organization administrator.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="sm:flex-row sm:justify-center">
          <Button onClick={() => setOpen(true)} type="button">
            <Building2Icon data-icon="inline-start" />
            Create Organization
          </Button>
          <SignOutButton />
        </EmptyContent>
      </Empty>

      <Dialog.Root onOpenChange={setOpen} open={open}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" />
          <Dialog.Viewport className="fixed inset-0 flex items-center justify-center p-5">
            <Dialog.Popup className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl outline-none">
              <Dialog.Title className="font-heading text-2xl font-semibold">
                Create Organization
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                You’ll become its owner and can start hosting Projects right away.
              </Dialog.Description>
              <form className="mt-6" onSubmit={createOrganization}>
                <FieldGroup>
                  <Field data-invalid={Boolean(error)}>
                    <FieldLabel htmlFor="organization-name">
                      Organization name
                    </FieldLabel>
                    <Input
                      aria-invalid={Boolean(error)}
                      autoFocus
                      id="organization-name"
                      minLength={2}
                      onChange={(event) => setName(event.target.value)}
                      required
                      value={name}
                    />
                    {error && <FieldError>{error}</FieldError>}
                  </Field>
                  <div className="flex justify-end gap-3">
                    <Dialog.Close
                      render={<Button type="button" variant="outline" />}
                    >
                      Cancel
                    </Dialog.Close>
                    <Button disabled={pending || !slugify(name)} type="submit">
                      {pending && (
                        <LoaderCircleIcon
                          className="animate-spin"
                          data-icon="inline-start"
                        />
                      )}
                      Create Organization
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
