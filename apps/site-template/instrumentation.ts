import * as Sentry from "@sentry/nextjs";

/** Sentry error monitoring (Phase 7). DSN-optional: without SENTRY_DSN /
 * NEXT_PUBLIC_SENTRY_DSN everything here is a no-op. Server render and route
 * handler errors flow through onRequestError; client errors through
 * instrumentation-client.ts + global-error.tsx. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
