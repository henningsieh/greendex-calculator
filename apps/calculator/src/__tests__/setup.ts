// Test setup file
// This file runs before all tests

import { vi } from "vitest";

// Tell React that this test environment supports act().
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Environment variables are loaded in global-setup.ts

// Mock the auth client to avoid environment variable validation during tests
vi.mock("@/lib/better-auth/auth-client", () => ({
  authClient: {
    organization: {
      checkSlug: vi.fn(),
    },
  },
}));

// Mock the env module to avoid environment variable validation
// Use getters to ensure environment variables are read AFTER dotenv loads them
vi.mock("@/env", () => ({
  get env() {
    return {
      get NEXT_PUBLIC_BASE_URL() {
        return process.env.NEXT_PUBLIC_BASE_URL;
      },
      get DATABASE_URL() {
        return process.env.DATABASE_URL;
      },
      BETTER_AUTH_SECRET: "test-secret",
      GOOGLE_CLIENT_ID: "123456789012-test-google-client-id",
      GOOGLE_CLIENT_SECRET: "GOCSPX-test-google-client-secret",
      DISCORD_CLIENT_ID: "1234567890123456789",
      DISCORD_CLIENT_SECRET: "test-discord-client-secret-32",
      GITHUB_CLIENT_ID: "12345678901234567890",
      GITHUB_CLIENT_SECRET: "test-github-client-secret-40-chars",
      SMTP_HOST: "localhost",
      SMTP_PORT: 587,
      SMTP_SENDER: "test@example.com",
      SMTP_USERNAME: "test",
      SMTP_PASSWORD: "test",
      SMTP_SECURE: false,
      NODE_ENV: "test",
      PORT: 3000,
      ORPC_DEV_DELAY_MS: 0,
      SOCKET_PORT: 4000,
    };
  },
}));
