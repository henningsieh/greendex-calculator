"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { orpc } from "@/lib/orpc/orpc";

export default function ORPCTestPage() {
  const [name, setName] = useState("World");
  const [helloResponse, setHelloResponse] = useState<string>("");
  const [healthResponse, setHealthResponse] = useState<string>("");
  const [profileResponse, setProfileResponse] = useState<string>("");
  const [loading, setLoading] = useState<{
    [key: string]: boolean;
  }>({});

  const fetchHealth = useCallback(() => orpc.health(), []);

  const testHealth = useCallback(async () => {
    setLoading((prev) => ({
      ...prev,
      health: true,
    }));
    try {
      const result = await fetchHealth();
      console.log("✅ Health Check Response:", result);
      setHealthResponse(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("❌ Health Check Error:", error);
      setHealthResponse(`Error: ${error}`);
    } finally {
      setLoading((prev) => ({
        ...prev,
        health: false,
      }));
    }
  }, [fetchHealth]);

  useEffect(() => {
    let cancelled = false;

    fetchHealth()
      .then((result) => {
        if (cancelled) return;
        console.log("✅ Health Check Response:", result);
        setHealthResponse(JSON.stringify(result, null, 2));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("❌ Health Check Error:", error);
        setHealthResponse(`Error: ${error}`);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchHealth]);

  const testHello = async () => {
    setLoading((prev) => ({
      ...prev,
      hello: true,
    }));
    try {
      const result = await orpc.helloWorld({
        name,
      });
      console.log("✅ Hello World Response:", result);
      setHelloResponse(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("❌ Hello World Error:", error);
      setHelloResponse(`Error: ${error}`);
    } finally {
      setLoading((prev) => ({
        ...prev,
        hello: false,
      }));
    }
  };

  // (testHealth is defined above with useCallback)

  const testProfile = async () => {
    setLoading((prev) => ({
      ...prev,
      profile: true,
    }));
    try {
      const result = await orpc.users.getProfile();
      console.log("✅ Profile Response:", result);
      setProfileResponse(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("❌ Profile Error:", error);
      setProfileResponse(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoading((prev) => ({
        ...prev,
        profile: false,
      }));
    }
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">oRPC Test Page</h1>
        <p className="text-muted-foreground">
          Test the end-to-end type-safe oRPC implementation
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Hello World Test */}
        <Card>
          <CardHeader>
            <CardTitle>Hello World</CardTitle>
            <CardDescription>Test basic procedure with input</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
              type="text"
              value={name}
            />
            <Button
              className="w-full"
              disabled={loading.hello}
              onClick={testHello}
            >
              {loading.hello ? "Loading..." : "Call Hello World"}
            </Button>
            {helloResponse && (
              <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                {helloResponse}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* Health Check Test */}
        <Card>
          <CardHeader>
            <CardTitle>Health Check</CardTitle>
            <CardDescription>Test server status endpoint</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full"
              disabled={loading.health}
              onClick={testHealth}
            >
              {loading.health ? "Loading..." : "Check Health"}
            </Button>
            {healthResponse && (
              <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                {healthResponse}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* Profile Test (Protected) */}
        <Card>
          <CardHeader>
            <CardTitle>Get Profile</CardTitle>
            <CardDescription>
              Test protected procedure (requires auth)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full"
              disabled={loading.profile}
              onClick={testProfile}
            >
              {loading.profile ? "Loading..." : "Get Profile"}
            </Button>
            {profileResponse && (
              <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                {profileResponse}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>
              <strong>Hello World:</strong> Public procedure that accepts a name
              parameter
            </li>
            <li>
              <strong>Health Check:</strong> Public procedure that returns server
              status
            </li>
            <li>
              <strong>Get Profile:</strong> Protected procedure that requires
              authentication
            </li>
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Check the browser console for detailed logs of each request.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
