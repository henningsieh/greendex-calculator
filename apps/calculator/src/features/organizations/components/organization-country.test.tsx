import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  invalidateQueries: vi.fn(),
  organization: {
    id: "org-id",
    name: "Country Org",
    slug: "country-org",
    country: "DE",
  },
}));
vi.mock("@/app/routes", () => ({ DASHBOARD_PATH: "/org" }));
vi.mock("@/lib/i18n/routing", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@greendex/i18n/client", () => ({
  useTranslations: () => (key: string) =>
    key === "label" ? "Organization country" : "Select an EU country",
}));
vi.mock("@/features/organizations/utils", () => ({
  findAvailableSlug: async () => "country-org",
}));
vi.mock("@/lib/better-auth/auth-client", () => ({
  authClient: { organization: { create: mocks.create, update: mocks.update } },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useSuspenseQuery: () => ({ data: mocks.organization }),
}));
vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    organizations: {
      getActive: { queryOptions: () => ({ queryKey: ["active"] }) },
      list: { queryOptions: () => ({ queryKey: ["list"] }) },
    },
  },
}));
vi.mock("@/components/country-select", () => ({
  CountrySelect: ({
    id,
    value,
    onValueChange,
  }: {
    id?: string;
    value?: string;
    onValueChange: (value: string) => void;
  }) => (
    <select
      id={id}
      value={value ?? ""}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="">Select an EU country</option>
      <option value="DE">Germany</option>
      <option value="FR">France</option>
    </select>
  ),
}));

import { CreateOrganizationForm } from "@/features/organizations/components/create-organization-form";
import { EditOrganizationForm } from "@/features/organizations/components/edit-organization-form";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.organization = {
    id: "org-id",
    name: "Country Org",
    slug: "country-org",
    country: "DE",
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function render(element: ReactNode) {
  await act(async () => root.render(element));
}
async function changeName(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[name="name"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function selectCountry(value: string) {
  const select = container.querySelector("select")!;
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function submit() {
  await act(async () =>
    container.querySelector<HTMLButtonElement>("button")!.click(),
  );
}

describe("Calculator Organization country forms", () => {
  it("reinitializes country and name when switching the active Organization", async () => {
    await render(<EditOrganizationForm />);
    expect(container.querySelector("select")?.value).toBe("DE");
    await changeName("Unsaved German name");
    mocks.organization = {
      id: "fr-org",
      name: "French Org",
      slug: "french-org",
      country: "FR",
    };
    await render(<EditOrganizationForm />);
    expect(container.querySelector("select")?.value).toBe("FR");
    await submit();
    expect(mocks.update).toHaveBeenCalledWith(
      {
        organizationId: "fr-org",
        data: { name: "French Org", slug: "french-org", country: "FR" },
      },
      expect.any(Object),
    );
  });

  it("requires a country selection and sends it through Better Auth creation", async () => {
    await render(<CreateOrganizationForm />);
    await changeName("Country Org");
    await submit();
    expect(mocks.create).not.toHaveBeenCalled();
    await selectCountry("DE");
    await submit();
    expect(mocks.create).toHaveBeenCalledWith(
      { name: "Country Org", slug: "country-org", country: "DE" },
      expect.any(Object),
    );
  });

  it("loads the existing country and corrects it through Better Auth update", async () => {
    await render(<EditOrganizationForm />);
    expect(container.querySelector("select")?.value).toBe("DE");
    await selectCountry("FR");
    await submit();
    expect(mocks.update).toHaveBeenCalledWith(
      {
        organizationId: "org-id",
        data: { name: "Country Org", slug: "country-org", country: "FR" },
      },
      expect.any(Object),
    );
  });
});
