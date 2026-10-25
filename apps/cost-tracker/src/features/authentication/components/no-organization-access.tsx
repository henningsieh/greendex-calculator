"use client";

import { EU_COUNTRIES, type EUCountryCode } from "@greendex/config/eu-countries";
import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import { slugifyOrganizationName as slugify } from "@/features/organizations/slug";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc } from "@/lib/orpc/orpc";

export function NoOrganizationAccess() {
  const router = useRouter();
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
      router.replace("/projects");
      router.refresh();
    } catch (error) {
      setError(getORPCRequestErrorMessage(error).text);
    } finally {
      setPending(false);
    }
  }

  return (
    <main
      className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-6 px-5 py-10 sm:px-8"
      data-testid="no-organization-access"
    >
      <header>
        <p className="text-sm font-medium text-primary">Your Organization</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
          A home for your Projects
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          Your personal login is ready. Now add your Organization to host Erasmus
          Projects. You&apos;ll become its Owner. You can create your first
          Project next, whenever you&apos;re ready.
        </p>
      </header>
      <form onSubmit={createOrganization}>
        <FieldGroup>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="organization-name">Organization name</FieldLabel>
            <Input
              disabled={pending}
              maxLength={100}
              aria-describedby={error ? "organization-error" : undefined}
              aria-invalid={Boolean(error)}
              id="organization-name"
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
            {error && (
              <FieldError
                id="organization-error"
                role="alert"
                data-testid="organization-error"
              >
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
          <div className="flex flex-wrap gap-3">
            <Button
              data-testid="create-organization"
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
            <SignOutButton />
          </div>
        </FieldGroup>
      </form>
      <p className="text-sm text-muted-foreground">
        Expecting an invitation? Open the link in your invitation email to join
        the right Organization instead.
      </p>
    </main>
  );
}
