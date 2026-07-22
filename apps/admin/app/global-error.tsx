"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/** Root error boundary: reports to Sentry (when configured) and gives the
 * operator something better than a white screen. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 2rem", maxWidth: "36rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
          Something went wrong
        </h1>
        <p style={{ color: "#555", marginBottom: "1.5rem" }}>
          The error has been recorded{error.digest ? ` (ref ${error.digest})` : ""}.
          Try again — if it keeps happening, tell the studio what you were doing.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{ padding: "0.5rem 1.25rem", borderRadius: "0.5rem", border: "1px solid #ccc", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
