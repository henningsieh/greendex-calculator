import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QueryProvider } from "@/components/providers/query-provider";

const mocks = vi.hoisted(() => ({
  dynamic: undefined as
    | undefined
    | { loader: () => Promise<unknown>; options: { ssr: boolean } },
  createQueryClient: vi.fn(),
  devtools: vi.fn(),
}));
vi.mock("@/lib/tanstack-react-query/client", () => ({
  createQueryClient: mocks.createQueryClient,
}));
vi.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: mocks.devtools,
}));
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>, options: { ssr: boolean }) => {
    mocks.dynamic = { loader, options };
    return ({ initialIsOpen }: { initialIsOpen: boolean }) => (
      <output data-testid="devtools">{String(initialIsOpen)}</output>
    );
  },
}));

let container: HTMLDivElement;
let root: Root;
const clients: QueryClient[] = [];
function Consumer({ label }: { label: string }) {
  const client = useQueryClient();
  return (
    <p>
      {label}:{client.getQueryData<string>(["message"])}
    </p>
  );
}

beforeEach(() => {
  mocks.createQueryClient.mockReset();
  mocks.createQueryClient.mockImplementation(() => {
    const client = new QueryClient();
    clients.push(client);
    return client;
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const client of clients) client.clear();
  clients.length = 0;
});

describe("query provider with client-only devtools", () => {
  it("disables SSR for the dynamic devtools and loads the named export", async () => {
    expect(mocks.dynamic?.options).toEqual({ ssr: false });
    expect(await mocks.dynamic?.loader()).toBe(mocks.devtools);
  });

  it("renders children and initially closed devtools while preserving the query cache across rerenders", () => {
    act(() =>
      root.render(
        <QueryProvider>
          <Consumer label="first" />
        </QueryProvider>,
      ),
    );
    clients[0].setQueryData(["message"], "cached value");
    act(() =>
      root.render(
        <QueryProvider>
          <Consumer label="second" />
        </QueryProvider>,
      ),
    );
    expect(mocks.createQueryClient).toHaveBeenCalledOnce();
    expect(container.querySelector("p")?.textContent).toBe("second:cached value");
    expect(container.querySelector('[data-testid="devtools"]')?.textContent).toBe(
      "false",
    );
  });

  it("creates a fresh cache when a provider is remounted", () => {
    act(() =>
      root.render(
        <QueryProvider>
          <Consumer label="first" />
        </QueryProvider>,
      ),
    );
    clients[0].setQueryData(["message"], "old session");
    act(() => root.render(null));
    act(() =>
      root.render(
        <QueryProvider>
          <Consumer label="second" />
        </QueryProvider>,
      ),
    );
    expect(mocks.createQueryClient).toHaveBeenCalledTimes(2);
    expect(clients[1]).not.toBe(clients[0]);
    expect(container.querySelector("p")?.textContent).toBe("second:");
  });
});
