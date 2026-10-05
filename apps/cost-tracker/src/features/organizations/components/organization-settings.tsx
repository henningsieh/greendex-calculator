"use client";

import { EU_COUNTRIES, type EUCountryCode } from "@greendex/config/eu-countries";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

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
  organization: { name: string; country: EUCountryCode };
}) {
  const queryClient = useQueryClient();
  const [country, setCountry] = useState(organization.country);
  const [notice, setNotice] = useState("");
  const update = useMutation({
    mutationFn: () => orpc.organizations.updateCountry({ country: country }),
    onSuccess: async () => {
      setNotice("Organization country saved.");
      await queryClient.invalidateQueries();
    },
    onError: (error) => setNotice(getORPCRequestErrorMessage(error).text),
  });

  function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    update.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{organization.name} settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={save}>
          <Field>
            <FieldLabel htmlFor="organization-country">
              Organization country
            </FieldLabel>
            <select
              id="organization-country"
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
          <Button disabled={update.isPending} type="submit">
            {update.isPending ? "Saving…" : "Save Organization country"}
          </Button>
          {notice && <p role={update.isError ? "alert" : "status"}>{notice}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
