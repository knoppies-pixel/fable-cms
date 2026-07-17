/**
 * Local-dev connection values shared by the seed and acceptance scripts.
 * The fallback keys are the well-known public keys every local Supabase
 * instance ships with ("supabase-demo" JWTs) — they are not secrets.
 * Real environments must provide the env vars.
 */

export const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

export const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

/** Content key for the seeded demo site. Local dev only — Phase 5's
 * create-site.ts generates real high-entropy keys per site. */
export const DEMO_SITE_API_KEY =
  process.env.DEMO_SITE_API_KEY ?? "local-dev-demo-content-key";

export const SEED_USERS = {
  studioAdmin: { email: "admin@studio.local", password: "local-dev-password" },
  demoEditor: { email: "editor@demo.local", password: "local-dev-password" },
} as const;
