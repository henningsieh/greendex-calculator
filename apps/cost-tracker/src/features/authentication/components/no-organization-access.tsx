"use client";

import { type EUCountryCode } from "@greendex/config/eu-countries";
import { useTranslations } from "@greendex/i18n/client";
import { ORPCError } from "@orpc/client";
import { LoaderCircleIcon } from "lucide-react";
import { useState, type SyntheticEvent } from "react";

import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { EUCountrySelector } from "@/components/eu-country-selector";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import { slugifyOrganizationName as slugify } from "@/features/organizations/slug";
import { useRouter } from "@/lib/i18n/routing";
import { getSafeErrorSituation } from "@/lib/orpc/error-contract";
import { orpc } from "@/lib/orpc/orpc";

export function NoOrganizationAccess() {
  const router = useRouter();
  const t = useTranslations("onboarding.createOrganization");
  const [name, setName] = useState("");
  const [country, setCountry] = useState<EUCountryCode | "">("");
  const [error, setError] = useState<React.ReactNode>();
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
      setError(<ErrorPresentation error={error} />);
      if (
        error instanceof ORPCError &&
        getSafeErrorSituation(error)?.reason ===
          "ORGANIZATION_CREATION_DENIED_BEFORE_CREATION"
      )
        router.refresh();
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
        <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl">{t("heading")}</h1>
        <p className="mt-4 leading-7 text-muted-foreground">{t("description")}</p>
      </header>
      <form onSubmit={createOrganization}>
        <FieldGroup>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="organization-name">{t("nameLabel")}</FieldLabel>
            <Input
              disabled={pending}
              maxLength={100}
              aria-describedby={error ? "organization-error" : undefined}
              aria-invalid={Boolean(error)}
              id="organization-name"
              data-testid="organization-name"
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
              {t("countryLabel")}
            </FieldLabel>
            <EUCountrySelector
              aria-required="true"
              id="organization-country"
              data-testid="organization-country"
              disabled={pending}
              value={country}
              onValueChange={setCountry}
            />
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
              {t("submit")}
            </Button>
            <SignOutButton />
          </div>
        </FieldGroup>
      </form>
      <p className="text-sm text-muted-foreground">{t("invitationHint")}</p>
    </main>
  );
}
