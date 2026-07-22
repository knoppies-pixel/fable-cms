export const dynamic = "force-dynamic";

/** Deliberate server error for verifying the Sentry pipeline end to end
 * (scripts/sentry-smoke.ts). Inert unless SENTRY_SMOKE=1 is set. */
export async function GET() {
  if (process.env.SENTRY_SMOKE !== "1") {
    return new Response("Not found", { status: 404 });
  }
  throw new Error("sentry-smoke: intentional server error (site)");
}
