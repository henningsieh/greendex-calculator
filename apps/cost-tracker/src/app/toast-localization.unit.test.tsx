import { LANGUAGE_CODES } from "@greendex/config/languages";
import { useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense, type ComponentProps, type ReactNode } from "react";
import { expect, it, vi } from "vitest";

import LocaleLayout from "@/app/[locale]/layout";
import RootLayout from "@/app/layout";
import { OrganizationSettings } from "@/features/organizations/components/organization-settings";
import { createSafeFieldIssue } from "@/lib/orpc/error-contract";
import { createSituationErrors } from "@/lib/orpc/errors";
import german from "@/messages/de";
import english from "@/messages/en";
import spanish from "@/messages/es";
import french from "@/messages/fr";
import italian from "@/messages/it";
import dutch from "@/messages/nl";
import slovenian from "@/messages/si";

const localeMessages: Record<string, typeof english> = {
  en: english,
  de: german,
  es: spanish,
  fr: french,
  it: italian,
  nl: dutch,
  si: slovenian,
};

vi.mock("@/lib/orpc/client.server", () => ({}));
vi.mock("@/lib/i18n/routing", async () => ({
  routing: {
    locales: (await import("@greendex/config/languages")).LANGUAGE_CODES,
  },
}));
vi.mock(
  "@/components/error-presentation/error-presentation",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("@/components/error-presentation/error-presentation")
      >();
    const { useLocale, useTranslations } = await import("@greendex/i18n/client");
    return {
      ...original,
      ErrorPresentation: function ObservedErrorPresentation(
        props: ComponentProps<typeof original.ErrorPresentation>,
      ) {
        const locale = useLocale();
        const t = useTranslations("apiErrors");
        const messages = localeMessages[locale];
        return (
          <>
            <span
              hidden
              data-testid="toast-locale"
              data-locale={locale}
              data-catalogue-matches={
                !!messages &&
                t.has("SETUP_LINK_EXPIRED") &&
                t("SETUP_LINK_EXPIRED") === messages.apiErrors.SETUP_LINK_EXPIRED
              }
            />
            <original.ErrorPresentation {...props} />
          </>
        );
      },
    };
  },
);
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "" }),
  Inter: () => ({ variable: "" }),
  JetBrains_Mono: () => ({ variable: "" }),
}));
vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/nuqs-provider", () => ({
  NuqsProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@greendex/i18n/server", () => ({
  getMessages: async ({ locale }: { locale: string }) => localeMessages[locale],
  getTimeZone: async () => "UTC",
  setRequestLocale: vi.fn(),
}));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: {
    organizations: {
      updateCountry: async () => {
        throw new Error("private server failure");
      },
    },
  },
  orpcQuery: {
    organizations: {
      getSettings: {
        queryOptions: () => ({
          queryKey: ["organization-settings"],
          queryFn: async () => ({
            id: "organization",
            name: "Organization",
            country: "DE",
          }),
        }),
      },
    },
  },
}));

async function renderLocalizedRoute(children: ReactNode, locale = "en") {
  const boundary = LocaleLayout({
    children,
    params: Promise.resolve({ locale }),
  });
  const localized = boundary.props.children;
  const content = await localized.type(localized.props);
  const root = await RootLayout({ children: content });
  return render(root.props.children.props.children);
}

function CachedQuery({ error }: { error: Error }) {
  const query = useQuery({
    queryKey: ["localized-refresh"],
    initialData: "Cached Project",
    queryFn: async () => {
      throw error;
    },
    meta: { costTrackerORPC: true },
    retry: false,
  });
  return (
    <>
      <span data-testid="cached-data" data-value={query.data}>
        {query.data}
      </span>
      <button type="button" onClick={() => void query.refetch()}>
        Refresh
      </button>
    </>
  );
}

it.each(LANGUAGE_CODES)(
  "preserves the %s locale, error catalogue and cached value through the actual layouts and Toaster",
  async (locale) => {
    await renderLocalizedRoute(
      <CachedQuery error={createSituationErrors().setupLinkExpired()} />,
      locale,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(
        document.querySelector('[data-slot="toast-description"]'),
      ).not.toBeNull();
    });
    const description = document.querySelector('[data-slot="toast-description"]');
    const probe = screen.getByTestId("toast-locale");
    expect(description).toContainElement(probe);
    expect(probe).toHaveAttribute("data-locale", locale);
    expect(probe).toHaveAttribute("data-catalogue-matches", "true");
    expect(screen.getByTestId("cached-data")).toHaveAttribute(
      "data-value",
      "Cached Project",
    );
    expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
    expect(description?.tagName).toBe("DIV");
    expect(description?.querySelectorAll("li")).toHaveLength(0);
    expect(description?.querySelector("p ul")).toBeNull();
  },
);

it("renders structured checklist details without nesting a list in a paragraph", async () => {
  await renderLocalizedRoute(
    <CachedQuery
      error={createSituationErrors().submissionIncomplete([
        createSafeFieldIssue("payoutAccountRequired", ["payoutAccount"]),
      ])}
    />,
  );
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => {
    expect(
      document.querySelectorAll('[data-slot="toast-description"] li'),
    ).toHaveLength(1);
  });
  expect(
    document.querySelector('[data-slot="toast-description"] p ul'),
  ).toBeNull();
});

it("renders a mutation failure through the actual layouts and Toaster", async () => {
  await renderLocalizedRoute(
    <Suspense fallback={null}>
      <OrganizationSettings />
    </Suspense>,
  );
  fireEvent.click(await screen.findByTestId("save-organization-country"));
  await waitFor(() => {
    expect(
      document.querySelector('[data-slot="toast-description"]'),
    ).not.toBeNull();
  });
  expect(screen.getByTestId("toast-locale")).toHaveAttribute("data-locale", "en");
  expect(screen.getByTestId("toast-locale")).toHaveAttribute(
    "data-catalogue-matches",
    "true",
  );
  expect(screen.getByTestId("save-organization-country")).not.toBeDisabled();
});
