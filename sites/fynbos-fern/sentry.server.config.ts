import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn), // unset DSN = clean no-op (local dev, unconfigured clones)
  tracesSampleRate: 0, // error monitoring only — tracing is not the Phase 7 goal
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
});
