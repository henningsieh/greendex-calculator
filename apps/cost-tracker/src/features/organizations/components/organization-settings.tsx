"use client";

import { EU_COUNTRIES, type EUCountryCode } from "@greendex/config/eu-countries";
import { useTranslations } from "@greendex/i18n/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
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
        description: getORPCRequestErrorMessage(error).text,
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
            <select
              id="organization-country"
              data-testid="organization-country"
              value={country}
              required
              disabled={update.isPending}
              onChange={(event) =>
                setCountry(event.target.value as EUCountryCode)
              }
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {EU_COUNTRIES.map(({ code }) => (
                <option key={code} value={code}>
                  {new Intl.DisplayNames(["en"], { type: "region" }).of(code)}
                </option>
              ))}
            </select>
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
