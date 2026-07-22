import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Contact-form interaction tokens: `${timestampMs}.${hmac}`. Issued by
 * /api/contact/token, verified by /api/contact. Signed with the site's
 * PREVIEW_SECRET — both ends live in this app, so any server-held per-site
 * secret works and no new env var is needed.
 */

/** Submissions younger than this are scripted; humans read and type. */
export const TOKEN_MIN_AGE_MS = 3_000;
/** Tokens older than this are stale (or replayed) — flagged, not dropped. */
export const TOKEN_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function formTokenSecret(): string | null {
  return process.env.PREVIEW_SECRET || process.env.REVALIDATE_SECRET || null;
}

export function signFormToken(timestampMs: number, secret: string): string {
  const signature = createHmac("sha256", secret)
    .update(String(timestampMs))
    .digest("hex");
  return `${timestampMs}.${signature}`;
}

export type TokenVerdict =
  | { valid: true; ageMs: number }
  | { valid: false; reason: "malformed" | "bad-signature" };

export function verifyFormToken(token: string, secret: string): TokenVerdict {
  const dot = token.indexOf(".");
  if (dot <= 0) return { valid: false, reason: "malformed" };
  const timestampPart = token.slice(0, dot);
  const timestampMs = Number(timestampPart);
  if (!Number.isFinite(timestampMs)) return { valid: false, reason: "malformed" };

  const expected = createHmac("sha256", secret)
    .update(timestampPart)
    .digest("hex");
  const given = token.slice(dot + 1);
  if (given.length !== expected.length) {
    return { valid: false, reason: "bad-signature" };
  }
  const matches = timingSafeEqual(
    Buffer.from(given, "utf8"),
    Buffer.from(expected, "utf8"),
  );
  if (!matches) return { valid: false, reason: "bad-signature" };
  return { valid: true, ageMs: Date.now() - timestampMs };
}
