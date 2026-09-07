"use client";

import {
  PROJECT_SHARED_TRANSPORT_EMISSION_PROFILES,
  type ProjectSharedTransportEmissionProfile,
} from "@greendex/config/transport-emission-profiles";
import { useTranslations } from "@greendex/i18n/client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransportEmissionProfileSchema } from "@/features/project-shared-travel-legs/validation-schemas";

import { TransportEmissionProfileIcon } from "./transport-emission-profile-icon";

interface TransportEmissionProfileSelectProps {
  id: string;
  value?: ProjectSharedTransportEmissionProfile;
  onValueChange: (value: ProjectSharedTransportEmissionProfile) => void;
}

export function TransportEmissionProfileSelect({
  id,
  value,
  onValueChange,
}: TransportEmissionProfileSelectProps) {
  const t = useTranslations("project.shared-travel");

  return (
    <Select
      onValueChange={(nextValue) => {
        const parsedProfile = TransportEmissionProfileSchema.safeParse(nextValue);
        if (parsedProfile.success) {
          onValueChange(parsedProfile.data);
        }
      }}
      value={value ?? ""}
    >
      <SelectTrigger id={id}>
        <SelectValue
          placeholder={t("form.transport-emission-profile-placeholder")}
        />
      </SelectTrigger>
      <SelectContent>
        {PROJECT_SHARED_TRANSPORT_EMISSION_PROFILES.map((profile) => (
          <SelectItem key={profile} value={profile}>
            <TransportEmissionProfileIcon profile={profile} />
            {t(`types.${profile}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
