import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import {
  formTokenSecret,
  verifyFormToken,
  TOKEN_MAX_AGE_MS,
  TOKEN_MIN_AGE_MS,
} from "@/lib/form-token";

export const dynamic = "force-dynamic";

const submission = z.object({
  name: z.string().min(1).max(120),
  email: z.email().max(200),
  phone: z.string().max(40).optional(),
  message: z.string().min(1).max(4000),
  /** Honeypot — humans never see this field; bots fill it. */
  website: z.string().optional(),
  /** Interaction token issued by /api/contact/token. */
  formToken: z.string().max(200).optional(),
  pageSlug: z.string().max(200).optional(),
});

/** More than this many links in a message is a spam tell, not a customer. */
const MAX_MESSAGE_LINKS = 3;

/**
 * Contact form endpoint. Spam defence in depth (honeypot + signed interaction
 * token + link heuristic), then the submission is forwarded to the CMS forms
 * API, which persists it and notifies the site owner. Heuristic hits are
 * stored flagged rather than dropped — a false positive costs a notification,
 * never the lead. Only unambiguous bots (honeypot, tokenless direct POSTs)
 * are turned away.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = submission.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }
  const data = parsed.data;

  // Honeypot tripped: unambiguous bot. Pretend success so it learns nothing;
  // nothing is stored.
  if (data.website) {
    return NextResponse.json({ ok: true });
  }

  const spamReasons: string[] = [];
  let tokenAgeMs: number | null = null;

  const secret = formTokenSecret();
  if (secret) {
    if (!data.formToken) {
      // The form always sends a token when the route is configured — a
      // missing one is a direct POST that never loaded the page. Refusing
      // (rather than silently dropping) lets a human with a broken fetch
      // retry, and the form auto-retries the token fetch on submit.
      return NextResponse.json(
        { error: "Could not verify the submission — please try again." },
        { status: 400 },
      );
    }
    const verdict = verifyFormToken(data.formToken, secret);
    if (!verdict.valid) {
      spamReasons.push(`token-${verdict.reason}`);
    } else {
      tokenAgeMs = verdict.ageMs;
      if (verdict.ageMs < TOKEN_MIN_AGE_MS) spamReasons.push("token-too-young");
      if (verdict.ageMs > TOKEN_MAX_AGE_MS) spamReasons.push("token-expired");
    }
  }

  const linkCount = (data.message.match(/https?:\/\//gi) ?? []).length;
  if (linkCount > MAX_MESSAGE_LINKS) spamReasons.push("link-heavy");

  const base = process.env.CMS_API_URL ?? "http://127.0.0.1:3000";
  const slug = process.env.SITE_SLUG;
  const apiKey = process.env.SITE_API_KEY;
  if (!slug || !apiKey) {
    console.error("[contact] SITE_SLUG / SITE_API_KEY missing — cannot deliver");
    return NextResponse.json(
      { error: "The contact form is not configured." },
      { status: 500 },
    );
  }

  const forwarded = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    message: data.message,
    pageSlug: data.pageSlug,
    spam: spamReasons.length > 0,
    meta: {
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        null,
      userAgent: request.headers.get("user-agent"),
      tokenAgeMs,
      spamReasons,
    },
  };

  try {
    const response = await fetch(`${base}/api/forms/${slug}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(forwarded),
      cache: "no-store",
    });
    if (response.status === 429) {
      return NextResponse.json(
        { error: "Too many messages right now — please try again later." },
        { status: 429 },
      );
    }
    if (!response.ok) {
      // A failing forms API is a lost-lead risk — the loudest alarm we have.
      console.error(`[contact] forms API responded ${response.status}`);
      Sentry.captureMessage(`contact: forms API responded ${response.status}`, "error");
      return NextResponse.json(
        { error: "Could not deliver your message — please try again." },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error(
      `[contact] forms API unreachable: ${error instanceof Error ? error.message : error}`,
    );
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Could not deliver your message — please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
