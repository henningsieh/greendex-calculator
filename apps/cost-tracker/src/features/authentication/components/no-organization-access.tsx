"use client";

import { EU_COUNTRIES, type EUCountryCode } from "@greendex/config/eu-countries";
import { Building2Icon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function NoOrganizationAccess() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
      router.refresh();
    } catch (error) {
      setError(getORPCRequestErrorMessage(error).text);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl items-center px-5 py-10 sm:px-8">
      <Empty data-testid="no-organization-access" variant="outlined">
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

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              You’ll become its owner and can start hosting Projects right away.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createOrganization}>
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
                {error && (
                  <FieldError data-testid="organization-error">
                    {error}
                  </FieldError>
                )}
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
                  className="h-10 w-full border-0 border-b border-input bg-transparent py-2 text-sm text-foreground outline-none focus-visible:border-ring"
                >
                  <option value="" disabled>
                    Select an EU country
                  </option>
                  {EU_COUNTRIES.map(({ code }) => (
                    <option key={code} value={code}>
                      {new Intl.DisplayNames(["en"], { type: "region" }).of(code)}
                    </option>
                  ))}
                </select>
              </Field>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Cancel
                </DialogClose>
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
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
