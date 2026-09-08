import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { orpc } from "@/lib/orpc/orpc";

/**
 * Server Component demonstrating oRPC usage during SSR
 * This uses the optimized server-side client (no HTTP overhead)
 */
export default async function ORPCServerExample() {
  // These calls happen on the server during SSR
  // Using the server-side client means no HTTP requests are made
  const health = await orpc.health();
  const hello = await orpc.helloWorld({
    name: "Server",
  });

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">oRPC Server Component Example</h1>
        <p className="text-muted-foreground">
          This page demonstrates oRPC usage in a Server Component (SSR optimized)
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Health Check
              <Badge variant="outline">{health.status}</Badge>
            </CardTitle>
            <CardDescription>Server status retrieved during SSR</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Status:</div>
              <div className="font-medium">{health.status}</div>

              <div className="text-muted-foreground">Environment:</div>
              <div className="font-medium">{health.environment}</div>

              <div className="text-muted-foreground">Uptime:</div>
              <div className="font-medium">{Math.floor(health.uptime)}s</div>

              <div className="text-muted-foreground">Timestamp:</div>
              <div className="text-xs font-medium">
                {new Date(health.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hello World</CardTitle>
            <CardDescription>Greeting retrieved during SSR</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Message:</div>
              <div className="font-medium">{hello.message}</div>

              <div className="text-muted-foreground">Timestamp:</div>
              <div className="text-xs font-medium">
                {new Date(hello.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How This Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ul className="list-inside list-disc space-y-1">
            <li>This is a Server Component (no "use client" directive)</li>
            <li>oRPC calls are made during Server-Side Rendering (SSR)</li>
            <li>
              The server-side client executes procedures directly (no HTTP
              requests)
            </li>
            <li>
              Data is fetched and rendered on the server before sending HTML to
              the client
            </li>
            <li>
              This provides optimal performance with zero client-side latency
            </li>
          </ul>
          <p className="mt-4 text-muted-foreground">
            Compare this with the{" "}
            <a className="underline" href="/orpc-test">
              /orpc-test page
            </a>{" "}
            which uses client-side RPC calls.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
