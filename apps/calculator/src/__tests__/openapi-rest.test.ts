/**
 * REST API Integration Tests for OpenAPI Endpoint
 *
 * This test suite verifies that the OpenAPI REST endpoint works correctly
 * and follows the OpenAPI specification standard.
 *
 * These tests are separate from the RPC tests and ensure the REST API layer
 * can be used by third-party integrations or tools that expect standard HTTP REST APIs.
 *
 * Note: These tests require a running server and are skipped in CI if the server is not available.
 */
import { chromium } from "playwright";
import { beforeAll, describe, expect, it } from "vitest";

import { env } from "@/env";

import { SEED_USER } from "../../scripts/seed";

const OPENAPI_VERSION_REGEX = /^3\.\d+\.\d+$/;
const baseUrl = `${env.NEXT_PUBLIC_BASE_URL}/api/openapi`;
let serverAvailable = false;

// Check if server is available before running tests
beforeAll(async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    console.log(`Checking server availability at: ${baseUrl}/health`);
    const response = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
    });
    console.log(`Server response status: ${response.status}`);
    if (response.ok) {
      serverAvailable = true;
      console.log("✅ Server is available");
    } else {
      serverAvailable = false;
      console.log("❌ Server responded but not OK");
    }
  } catch (error) {
    serverAvailable = false;
    console.warn(
      "⚠️  OpenAPI server not running, skipping integration tests",
      error,
    );
  } finally {
    clearTimeout(timeout);
  }
});

describe("OpenAPI REST Endpoint", () => {
  describe("SSR oRPC client", () => {
    it("uses server-side client during SSR and doesn't call /api/rpc", async () => {
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
          return (originalFetch as (...a: unknown[]) => Promise<unknown>)(
            ...args,
          );
        }
        return Promise.reject(new Error("No fetch available"));
      };

      try {
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
    });
  });

  describe("Public Endpoints", () => {
    it("should return health status via GET /health", async () => {
      if (!serverAvailable) {
        return it.skip("Server not available");
      }

      const response = await fetch(`${baseUrl}/health`, {
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
      if (!serverAvailable) {
        return it.skip("Server not available");
      }

      const response = await fetch(`${baseUrl}/helloWorld`, {
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
      if (!serverAvailable) {
        return it.skip("Server not available");
      }

      const response = await fetch(`${baseUrl}/helloWorld`, {
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
      if (!serverAvailable) {
        return it.skip("Server not available");
      }

      const requestBody = { name: "Alice" };
      const response = await fetch(`${baseUrl}/helloWorld`, {
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
      if (!serverAvailable) {
        throw new Error("Server not available");
      }
      const response = await fetch(`${baseUrl}/users/profile`, {
        method: "GET",
      });

      // Should be unauthorized
      expect(response.status).toBe(401);
    });

    it("should return session info when requesting /auth/session", async () => {
      if (!serverAvailable) {
        throw new Error("Server not available");
      }
      const response = await fetch(`${baseUrl}/auth/session`, {
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
      if (!serverAvailable) {
        throw new Error("Server not available");
      }

      const response = await fetch(`${baseUrl}/auth/sign-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: SEED_USER.email,
          password: SEED_USER.password,
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
      expect(data.user).toHaveProperty("name", SEED_USER.name);
      expect(data.user).toHaveProperty("email", SEED_USER.email);
      expect(data.user).toHaveProperty("emailVerified", true);

      // Should set session cookies
      const cookies = response.headers.get("set-cookie");
      expect(cookies).toBeDefined();
      expect(cookies).toContain("better-auth.session_token");
    });

    it("should sign up new user via POST /auth/sign-up", async () => {
      if (!serverAvailable) {
        throw new Error("Server not available");
      }

      const newUser = {
        name: "Test User",
        email: `test-${Date.now()}@sieh.org`,
        password: "TestPassword123!",
      };

      const response = await fetch(`${baseUrl}/auth/sign-up`, {
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
      if (!serverAvailable) {
        throw new Error("Server not available");
      }

      const response = await fetch(`${baseUrl}/auth/sign-in`, {
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
      if (!serverAvailable) {
        throw new Error("Server not available");
      }

      // First sign in to get a session
      const signInResponse = await fetch(`${baseUrl}/auth/sign-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: SEED_USER.email,
          password: SEED_USER.password,
        }),
      });

      expect(signInResponse.status).toBe(200);
      const cookies = signInResponse.headers.get("set-cookie");
      expect(cookies).toBeDefined();

      // Now sign out using the session cookies
      const signOutResponse = await fetch(`${baseUrl}/auth/sign-out`, {
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
      if (!serverAvailable) {
        throw new Error("Server not available");
      }

      // Sign in
      const signInResponse = await fetch(`${baseUrl}/auth/sign-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: SEED_USER.email,
          password: SEED_USER.password,
        }),
      });

      expect(signInResponse.status).toBe(200);
      const cookies = signInResponse.headers.get("set-cookie");
      expect(cookies).toBeDefined();

      // Use session to access protected endpoint
      const profileResponse = await fetch(`${baseUrl}/users/profile`, {
        method: "GET",
        headers: {
          Cookie: cookies || "",
          "Content-Type": "application/json",
        },
      });

      expect(profileResponse.status).toBe(200);
      const profileData = await profileResponse.json();
      expect(profileData).toHaveProperty("user");
      expect(profileData.user).toHaveProperty("email", SEED_USER.email);

      // Verify session is still active
      const sessionResponse = await fetch(`${baseUrl}/auth/session`, {
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
      expect(sessionData.user).toHaveProperty("email", SEED_USER.email);
    });

    it("should invalidate session after sign out", async () => {
      if (!serverAvailable) {
        throw new Error("Server not available");
      }

      // Sign in
      const signInResponse = await fetch(`${baseUrl}/auth/sign-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: SEED_USER.email,
          password: SEED_USER.password,
        }),
      });

      expect(signInResponse.status).toBe(200);
      const cookies = signInResponse.headers.get("set-cookie");
      expect(cookies).toBeDefined();

      // Sign out
      const signOutResponse = await fetch(`${baseUrl}/auth/sign-out`, {
        method: "POST",
        headers: {
          Cookie: cookies || "",
          "Content-Type": "application/json",
        },
      });

      expect(signOutResponse.status).toBe(200);

      // Verify session is invalidated
      const sessionResponse = await fetch(`${baseUrl}/auth/session`, {
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
      if (!serverAvailable) {
        throw new Error("Server not available");
      }
      const response = await fetch(`${baseUrl}/non-existent-endpoint`, {
        method: "GET",
      });

      expect(response.status).toBe(404);

      const text = await response.text();
      expect(text).toBe("Not found");
    });

    it("should handle invalid JSON input gracefully", async () => {
      if (!serverAvailable) {
        throw new Error("Server not available");
      }
      const response = await fetch(`${baseUrl}/helloWorld`, {
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
      if (!serverAvailable) {
        throw new Error("Server not available");
      }
      const response = await fetch(`${baseUrl}/health`, {
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
      if (!serverAvailable) {
        throw new Error("Server not available");
      }
      const response = await fetch(`${baseUrl}/health`, {
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
    if (!serverAvailable) {
      throw new Error("Server not available");
    }

    const response = await fetch(docsUrl);
    expect(response.status).toBe(200);

    const contentType = response.headers.get("Content-Type") || "";
    expect(contentType).toContain("text/html");

    const html = await response.text();

    // Embedded configuration script should exist
    expect(html).toContain('id="app"');
    // Should reference Scalar script
    expect(html).toContain("https://cdn.jsdelivr.net/npm/@scalar/api-reference");
  });

  it("should render accessible API documentation UI", async () => {
    if (!serverAvailable) {
      throw new Error("Server not available");
    }

    // Verify the docs page is available and the Scalar UI actually renders.
    // Uses stable markers from the plugin's own HTML template (#app), the
    // <main> landmark Scalar mounts, and the page title instead of a
    // Scalar-internal aria-label, which changes between Scalar versions.
    const browser = await chromium.launch({
      headless: process.env.HEADED !== "true",
    });
    try {
      const page = await browser.newPage();
      await page.goto(docsUrl, { timeout: 10_000 });
      await page.waitForSelector("div#app", {
        timeout: 10_000,
      });
      // Scalar mounts its UI once the bundle executes
      await page.waitForSelector("main", { timeout: 10_000 });
      // The docs heading shows the API title from specGenerateOptions.info.title
      await page.waitForSelector("h1.section-header-label", {
        timeout: 10_000,
      });
      expect(
        await page.locator("h1.section-header-label").textContent(),
      ).toContain("Greendex Calculator API");
      expect(await page.title()).toContain("API Reference");
    } finally {
      await browser.close();
    }
  });
});

describe("OpenAPI Specification", () => {
  const specUrl = `${env.NEXT_PUBLIC_BASE_URL}/api/openapi-spec`;

  it("should serve OpenAPI specification", async () => {
    if (!serverAvailable) {
      throw new Error("Server not available");
    }
    const response = await fetch(specUrl);
    expect(response.status).toBe(200);

    const spec = await response.json();

    // Verify it's a valid OpenAPI spec
    expect(spec).toHaveProperty("openapi");
    expect(spec.openapi).toMatch(OPENAPI_VERSION_REGEX); // Should be OpenAPI 3.x.x

    expect(spec).toHaveProperty("info");
    expect(spec.info).toHaveProperty("title");
    expect(spec.info).toHaveProperty("version");

    expect(spec).toHaveProperty("paths");
    expect(typeof spec.paths).toBe("object");

    // The spec should include a servers entry so documentation tools like
    // Scalar can resolve the correct base URL for endpoint examples.
    expect(spec).toHaveProperty("servers");
    expect(Array.isArray(spec.servers)).toBe(true);
    expect(spec.servers.map((s: any) => s.url)).toContain("/api/openapi");

    // Check that some of our endpoints are documented
    expect(spec.paths).toHaveProperty("/health");
    expect(spec.paths).toHaveProperty("/helloWorld");
  });
});
