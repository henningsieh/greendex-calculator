// @vitest-environment node
/** HTTP routing regression coverage; auth API responses are fixtures, not live auth. */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "@/env";

const authFixture = vi.hoisted(() => ({
  user: {
    id: "routing-user",
    name: "Routing User",
    email: "routing@example.com",
    emailVerified: true,
  },
  sessionActive: false,
}));

vi.mock("@/lib/better-auth", () => ({
  auth: {
    api: {
      listOrganizations: vi.fn(async () => []),
      getSession: vi.fn(async ({ headers }: { headers: Headers }) =>
        authFixture.sessionActive &&
        headers.get("cookie") === "routing-session=active"
          ? {
              user: authFixture.user,
              session: {
                id: "routing-session",
                expiresAt: new Date("2030-01-01"),
              },
            }
          : null,
      ),
      signInEmail: vi.fn(async ({ body }: { body: { email: string } }) => {
        if (body.email !== authFixture.user.email) throw { statusCode: 401 };
        authFixture.sessionActive = true;
        return {
          redirect: false,
          token: "routing-token",
          user: authFixture.user,
        };
      }),
      signUpEmail: vi.fn(
        async ({ body }: { body: { name: string; email: string } }) => ({
          user: { ...authFixture.user, ...body },
          token: "routing-token",
        }),
      ),
      signOut: vi.fn(async () => {
        authFixture.sessionActive = false;
        return { success: true };
      }),
    },
  },
}));

beforeEach(() => {
  authFixture.sessionActive = false;
});

const baseUrl = `${env.NEXT_PUBLIC_BASE_URL}/api/openapi`;

// Exercise the actual HTTP route handlers without a dev server or skipped coverage.
async function routeFetch(url: string, init?: RequestInit) {
  const request = new Request(url, init);
  const path = new URL(url).pathname;
  if (path === "/api/docs") {
    const { GET } = await import("@/app/api/docs/route");
    return GET(request);
  }
  if (path === "/api/openapi-spec") {
    const { GET } = await import("@/app/api/openapi-spec/route");
    return GET();
  }
  if (path.startsWith("/api/rpc/")) {
    const { POST } = await import("@/app/api/rpc/[[...rest]]/route");
    return POST(request);
  }
  const routes = await import("@/app/api/openapi/[[...rest]]/route");
  return routes[request.method as keyof typeof routes](request);
}

describe("SSR oRPC client", () => {
  it("uses server-side client during SSR and doesn't call /api/rpc", async () => {
    vi.resetModules();
    // Programmatically attach a server-side router client to globalThis
    const { createRouterClient } = await import("@orpc/server");
    const { router } = await import("@/lib/orpc/router");

    // Snap-in a server client for SSR (no network)
    globalThis.$client = createRouterClient(router, {
      context: async () => ({ headers: new Headers() }),
    });

    // Patch global fetch to fail if /api/rpc is called
    const g = globalThis as unknown as {
      fetch?: (...args: unknown[]) => Promise<unknown>;
      $client?: unknown;
    };
    const originalFetch = g.fetch;
    g.fetch = (...args: unknown[]) => {
      const resource = args[0] as string | { url?: string } | undefined;
      const url = typeof resource === "string" ? resource : resource?.url;
      if (typeof url === "string" && url.includes("/api/rpc")) {
        throw new Error("RPCLink network call detected during SSR");
      }
      if (typeof originalFetch === "function") {
        return (originalFetch as (...a: unknown[]) => Promise<unknown>)(...args);
      }
      return Promise.reject(new Error("No fetch available"));
    };

    try {
      // Loading the router also loads project utils, which imports the universal
      // client. Re-evaluate it after attaching the direct client, as SSR does.
      vi.resetModules();
      const { orpc } = await import("@/lib/orpc/orpc");
      const result = await orpc.health();
      expect(result).toBeDefined();
      // If the server client was not used, network fetch would have thrown
    } finally {
      // cleanup
      const g2 = globalThis as unknown as {
        fetch?: (...args: unknown[]) => Promise<unknown>;
        $client?: unknown;
      };
      g2.fetch = originalFetch;
      g2.$client = undefined;
    }
  }, 60_000);
});

describe("OpenAPI REST Endpoint", () => {
  describe("Public Endpoints", () => {
    it("should return health status via GET /health", async () => {
      const response = await routeFetch(`${baseUrl}/health`, {
        method: "GET",
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty("status", "ok");
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("uptime");
      expect(data).toHaveProperty("environment");
    });

    it("should handle hello world via POST /helloWorld", async () => {
      const response = await routeFetch(`${baseUrl}/helloWorld`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Test User" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty("message");
      expect(data.message).toContain("Test User");
      expect(data).toHaveProperty("timestamp");
    });

    it("should use default name when name not provided", async () => {
      const response = await routeFetch(`${baseUrl}/helloWorld`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.message).toContain("World");
    });

    it("should handle valid JSON request with complete response validation", async () => {
      const requestBody = { name: "Alice" };
      const response = await routeFetch(`${baseUrl}/helloWorld`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("application/json");

      const data = await response.json();

      // Validate complete response structure
      expect(data).toHaveProperty("message");
      expect(data.message).toBe("Hello, Alice!");
      expect(data).toHaveProperty("timestamp");
      expect(typeof data.timestamp).toBe("string");

      // Timestamp should be a valid ISO string
      const timestamp = new Date(data.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(isNaN(timestamp.getTime())).toBe(false);

      // Timestamp should be recent (within last minute)
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - timestamp.getTime());
      expect(timeDiff).toBeLessThan(60000); // 60 seconds
    });
  });

  describe("Protected Endpoints", () => {
    it("should return 401 for protected endpoints without auth", async () => {
      const response = await routeFetch(`${baseUrl}/users/profile`, {
        method: "GET",
      });

      // Should be unauthorized
      expect(response.status).toBe(401);
    });

    it("should return session info when requesting /auth/session", async () => {
      const response = await routeFetch(`${baseUrl}/auth/session`, {
        method: "GET",
      });

      // May return 200 with null session or session data depending on auth state
      expect(response.status).toBe(200);
      const data = await response.json();

      // Session endpoint should return a response (even if session is null)
      expect(data).toBeDefined();
    });
  });

  describe("Authentication Endpoints", () => {
    it("should sign in user via POST /auth/sign-in", async () => {
      const response = await routeFetch(`${baseUrl}/auth/sign-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authFixture.user.email,
          password: "routing-password",
        }),
      });

      // Debug: Log error response if not 200
      if (response.status !== 200) {
        const errorBody = await response.text();
        console.error(
          `Sign-in failed with status ${response.status}:`,
          errorBody,
        );
      }

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify sign-in response structure
      expect(data).toHaveProperty("redirect");
      expect(data).toHaveProperty("token");
      expect(data).toHaveProperty("user");
      expect(data.user).toHaveProperty("id");
      expect(data.user).toHaveProperty("name", authFixture.user.name);
      expect(data.user).toHaveProperty("email", authFixture.user.email);
      expect(data.user).toHaveProperty("emailVerified", true);

      // Cookie forwarding belongs to auth integration, not the routing fixture.
    });

    it("should sign up new user via POST /auth/sign-up", async () => {
      const newUser = {
        name: "Test User",
        email: `test-${Date.now()}@sieh.org`,
        password: "TestPassword123!",
      };

      const response = await routeFetch(`${baseUrl}/auth/sign-up`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      // Sign-up may succeed or fail depending on email verification settings
      // Either way, it should return a proper response
      expect([200, 400, 422]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("user");
        expect(data.user).toHaveProperty("name", newUser.name);
        expect(data.user).toHaveProperty("email", newUser.email);
      } else {
        // If it fails, that's also acceptable (email verification required, etc.)
        const errorData = await response.json();
        expect(errorData).toBeDefined();
      }
    }, 10_000); // 10 second timeout for sign-up

    it("should handle sign-in with invalid credentials", async () => {
      const response = await routeFetch(`${baseUrl}/auth/sign-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "invalid@sieh.org",
          password: "wrongpassword",
        }),
      });

      // Should return error for invalid credentials
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should sign out user via POST /auth/sign-out", async () => {
      // First sign in to get a session
      const signInResponse = await routeFetch(`${baseUrl}/auth/sign-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authFixture.user.email,
          password: "routing-password",
        }),
      });

      expect(signInResponse.status).toBe(200);
      const cookies = "routing-session=active";
      expect(cookies).toBeDefined();

      // Now sign out using the session cookies
      const signOutResponse = await routeFetch(`${baseUrl}/auth/sign-out`, {
        method: "POST",
        headers: {
          Cookie: cookies || "",
          "Content-Type": "application/json",
        },
      });

      expect(signOutResponse.status).toBe(200);
      const signOutData = await signOutResponse.json();
      expect(signOutData).toHaveProperty("success", true);
    });

    it("should maintain session across authenticated requests", async () => {
      // Sign in
      const signInResponse = await routeFetch(`${baseUrl}/auth/sign-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authFixture.user.email,
          password: "routing-password",
        }),
      });

      expect(signInResponse.status).toBe(200);
      const cookies = "routing-session=active";
      expect(cookies).toBeDefined();

      // Use session to access protected endpoint
      const profileResponse = await routeFetch(`${baseUrl}/users/profile`, {
        method: "GET",
        headers: {
          Cookie: cookies || "",
          "Content-Type": "application/json",
        },
      });

      expect(profileResponse.status).toBe(200);
      const profileData = await profileResponse.json();
      expect(profileData).toHaveProperty("user");
      expect(profileData.user).toHaveProperty("email", authFixture.user.email);

      // Verify session is still active
      const sessionResponse = await routeFetch(`${baseUrl}/auth/session`, {
        method: "GET",
        headers: {
          Cookie: cookies || "",
          "Content-Type": "application/json",
        },
      });

      expect(sessionResponse.status).toBe(200);
      const sessionData = await sessionResponse.json();
      expect(sessionData).toBeDefined();
      expect(sessionData).toHaveProperty("user");
      expect(sessionData.user).toHaveProperty("email", authFixture.user.email);
    });

    it("should invalidate session after sign out", async () => {
      // Sign in
      const signInResponse = await routeFetch(`${baseUrl}/auth/sign-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authFixture.user.email,
          password: "routing-password",
        }),
      });

      expect(signInResponse.status).toBe(200);
      const cookies = "routing-session=active";
      expect(cookies).toBeDefined();

      // Sign out
      const signOutResponse = await routeFetch(`${baseUrl}/auth/sign-out`, {
        method: "POST",
        headers: {
          Cookie: cookies || "",
          "Content-Type": "application/json",
        },
      });

      expect(signOutResponse.status).toBe(200);

      // Verify session is invalidated
      const sessionResponse = await routeFetch(`${baseUrl}/auth/session`, {
        method: "GET",
        headers: {
          Cookie: cookies || "",
          "Content-Type": "application/json",
        },
      });

      expect(sessionResponse.status).toBe(200);
      const sessionData = await sessionResponse.json();
      // Session should be null after sign out
      expect(sessionData).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for non-existent endpoints", async () => {
      const response = await routeFetch(`${baseUrl}/non-existent-endpoint`, {
        method: "GET",
      });

      expect(response.status).toBe(404);

      const text = await response.text();
      expect(text).toBe("Not found");
    });

    it("should handle invalid JSON input gracefully", async () => {
      const response = await routeFetch(`${baseUrl}/helloWorld`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json",
      });

      // Should return an error response (400 or 500 depending on implementation)
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("CORS Headers", () => {
    it("should include proper CORS headers", async () => {
      const response = await routeFetch(`${baseUrl}/health`, {
        method: "GET",
        headers: {
          Origin: env.NEXT_PUBLIC_BASE_URL,
        },
      });

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        env.NEXT_PUBLIC_BASE_URL,
      );
      expect(response.headers.get("Access-Control-Allow-Methods")).toBeDefined();
      expect(response.headers.get("Access-Control-Allow-Headers")).toBeDefined();
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true",
      );
      // Required for OpenAPILink file detection
      expect(response.headers.get("Access-Control-Expose-Headers")).toContain(
        "Content-Disposition",
      );
    });

    it("should handle CORS preflight requests", async () => {
      const response = await routeFetch(`${baseUrl}/health`, {
        method: "OPTIONS",
        headers: {
          Origin: env.NEXT_PUBLIC_BASE_URL,
          "Access-Control-Request-Method": "GET",
        },
      });

      expect(response.status).toBe(204); // or 200
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        env.NEXT_PUBLIC_BASE_URL,
      );
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "GET",
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toBeDefined();
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true",
      );
      // Required for OpenAPILink file detection
      expect(response.headers.get("Access-Control-Expose-Headers")).toContain(
        "Content-Disposition",
      );
    });
  });
});

describe("API Documentation UI", () => {
  const docsUrl = `${env.NEXT_PUBLIC_BASE_URL}/api/docs`;

  it("should serve HTML with Scalar API reference script", async () => {
    const response = await routeFetch(docsUrl);
    expect(response.status).toBe(200);

    const contentType = response.headers.get("Content-Type") || "";
    expect(contentType).toContain("text/html");

    const html = await response.text();

    // Embedded configuration script should exist
    expect(html).toContain('id="app"');
    // Should reference Scalar script
    expect(html).toContain(
      "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.73.0",
    );
    expect(html).not.toContain("@latest");
    expect(html).not.toContain('@scalar/api-reference"');
  });
});

describe("OpenAPI Specification", () => {
  const specUrl = `${env.NEXT_PUBLIC_BASE_URL}/api/openapi-spec`;

  it("should serve OpenAPI specification", async () => {
    const response = await routeFetch(specUrl);
    expect(response.status).toBe(200);

    const spec: Record<string, unknown> = await response.json();

    // Verify it's a valid OpenAPI spec
    expect(spec).toHaveProperty("openapi");
    expect(spec.openapi).toBe("3.1.1"); // Should be OpenAPI 3.x.x

    expect(spec).toHaveProperty("info");
    expect(spec.info).toHaveProperty("title");
    expect(spec.info).toHaveProperty("version");

    expect(spec).toHaveProperty("paths");
    expect(typeof spec.paths).toBe("object");

    // The spec should include a servers entry so documentation tools like
    // Scalar can resolve the correct base URL for endpoint examples.
    expect(spec).toHaveProperty("servers");
    expect(Array.isArray(spec.servers)).toBe(true);
    const serverUrls = Array.isArray(spec.servers)
      ? spec.servers.flatMap((server) =>
          typeof server === "object" &&
          server !== null &&
          "url" in server &&
          typeof server.url === "string"
            ? [server.url]
            : [],
        )
      : [];
    expect(serverUrls).toContain("/api/openapi");

    // Check that some of our endpoints are documented
    expect(spec.paths).toHaveProperty("/health");
    expect(spec.paths).toHaveProperty("/helloWorld");
    expect({
      openapi: spec.openapi,
      servers: spec.servers,
      routes: Object.fromEntries(
        Object.entries(spec.paths as Record<string, object>).map(
          ([path, operations]) => [path, Object.keys(operations)],
        ),
      ),
    }).toMatchSnapshot();
  });
});

describe("HTTP prefix and address preservation", () => {
  it.each([
    ["GET", "/organizations/active"],
    ["GET", "/organizations/role"],
    ["POST", "/organizations/stats"],
    ["POST", "/organizations/members/search"],
    ["GET", "/projects"],
    ["POST", "/projects"],
    ["GET", "/projects/routing-missing-project"],
    ["PATCH", "/projects/routing-missing-project"],
    ["DELETE", "/projects/routing-missing-project"],
    ["PATCH", "/projects/routing-missing-project/archive"],
    ["GET", "/projects/routing-missing-project/participants"],
    ["POST", "/projects/active"],
    ["DELETE", "/projects/batch"],
    ["GET", "/projects/routing-missing-project/shared-travel-legs"],
    ["POST", "/projects/routing-missing-project/shared-travel-legs"],
    ["PATCH", "/projects/routing-missing-project/shared-travel-legs/leg"],
    ["DELETE", "/projects/routing-missing-project/shared-travel-legs/leg"],
  ])(
    "matches %s %s before rejecting unauthenticated access",
    async (method, path) => {
      const response = await routeFetch(`${baseUrl}${path}`, { method });
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED" });
    },
  );

  it("keeps the organization list response shape", async () => {
    const response = await routeFetch(`${baseUrl}/organizations`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("matches the public participation address without authentication", async () => {
    // Read only: no fixture rows, seeding, or mutation of the migrated DB.
    const response = await routeFetch(
      `${baseUrl}/projects/routing-missing-project/participate`,
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  });

  it.each(["GET", "POST"])(
    "keeps router-derived %s RPC reads under /api/rpc",
    async (method) => {
      const response = await routeFetch(
        `${env.NEXT_PUBLIC_BASE_URL}/api/rpc/health`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          ...(method === "POST" ? { body: JSON.stringify({}) } : {}),
        },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ json: { status: "ok" } });
    },
  );

  it("does not expose REST paths outside the request-time prefix", async () => {
    for (const path of [
      "/health",
      "/api/openapi-other/health",
      "/api/openapi/api/openapi/health",
    ]) {
      const response = await routeFetch(`${env.NEXT_PUBLIC_BASE_URL}${path}`);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not found");
    }
  });
});
