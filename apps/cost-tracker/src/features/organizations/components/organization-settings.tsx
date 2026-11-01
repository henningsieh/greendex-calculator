"use client";

import { useTranslations } from "@greendex/i18n/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState, type SyntheticEvent } from "react";

import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { EUCountrySelector } from "@/components/eu-country-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

export function OrganizationSettings() {
  const options = orpcQuery.organizations.getSettings.queryOptions({
    meta: { costTrackerORPC: true },
  });
  const { data } = useSuspenseQuery(options);
  return <CountrySettings key={data.id} organization={data} />;
}

function CountrySettings({
  organization,
}: {
  organization: Outputs["organizations"]["getSettings"];
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("organizations.settings");
  const [country, setCountry] = useState(organization.country);
  const update = useMutation({
    mutationFn: () => orpc.organizations.updateCountry({ country }),
    onSuccess: async () => {
      toast.add({ title: t("saved"), type: "success" });
      await queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.add({
        description: <ErrorPresentation error={error} />,
        title: t("saveError"),
        type: "error",
      });
    },
  });

  function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    update.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title", { organization: organization.name })}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={save}>
          <Field>
            <FieldLabel htmlFor="organization-country">{t("country")}</FieldLabel>
            <EUCountrySelector
              aria-required="true"
              id="organization-country"
              data-testid="organization-country"
              disabled={update.isPending}
              value={country}
              onValueChange={(value) => {
                if (value) setCountry(value);
              }}
            />
          </Field>
          <Button
            data-testid="save-organization-country"
            disabled={update.isPending}
            type="submit"
          >
            {update.isPending ? t("saving") : t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
