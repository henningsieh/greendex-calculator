"use client";

import { Dialog } from "@base-ui/react/dialog";
import { EU_COUNTRIES, type EUCountryCode } from "@greendex/config/eu-countries";
import { Building2Icon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type SyntheticEvent } from "react";

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
import { slugifyOrganizationName as slugify } from "@/features/organizations/slug";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc } from "@/lib/orpc/orpc";

export function NoOrganizationAccess({ autoOpen }: { autoOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [name, setName] = useState("");
  const [country, setCountry] = useState<EUCountryCode | "">("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function createOrganization(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!country) return;
    setError(undefined);
    setPending(true);

    try {
      await orpc.authentication.createOrganization({
        name,
        slug: slugify(name),
        country: country,
      });
      setOpen(false);
      router.replace("/projects");
    } catch (error) {
      setError(getORPCRequestErrorMessage(error).text);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl items-center px-5 py-10 sm:px-8">
      <Empty variant="outlined">
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
              <Dialog.Description className="mt-2 text-sm/6 text-muted-foreground">
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

                      id="organization-name"
                      minLength={2}
                      onChange={(event) => setName(event.target.value)}
                      required
                      value={name}
                    />
                    {error && <FieldError>{error}</FieldError>}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="organization-country">
                      Organization country
                    </FieldLabel>
                    <select
                      id="organization-country"
                      required
                      disabled={pending}
                      value={country}
                      onChange={(event) =>
                        setCountry(event.target.value as EUCountryCode)
                      }
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="" disabled>
                        Select an EU country
                      </option>
                      {EU_COUNTRIES.map(({ code }) => (
                        <option key={code} value={code}>
                          {new Intl.DisplayNames(["en"], { type: "region" }).of(
                            code,
                          )}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="flex justify-end gap-3">
                    <Dialog.Close
                      render={<Button type="button" variant="outline" />}
                    >
                      Cancel
                    </Dialog.Close>
                    <Button
                      disabled={pending || !slugify(name) || !country}
                      type="submit"
                    >
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
