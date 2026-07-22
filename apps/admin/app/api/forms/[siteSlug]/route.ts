import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import type { Json } from "@fable/db";
import { authenticateSiteRequest } from "@/lib/site-api-key";
import { serviceClient } from "@/lib/service-client";

export const dynamic = "force-dynamic";

/**
 * Form-submission ingest. The client site's /api/contact route forwards here
 * with its site API key (site runtimes never talk to Supabase directly).
 * Submissions are persisted first — email notification is best-effort on top,
 * so a mail-provider outage can never lose a lead.
 */

const submission = z.object({
  name: z.string().min(1).max(120),
  email: z.string().max(200),
  phone: z.string().max(40).optional(),
  message: z.string().min(1).max(4000),
  pageSlug: z.string().max(200).optional(),
  /** Set by the site route when a spam heuristic tripped (stored, never emailed). */
  spam: z.boolean().default(false),
  meta: z.record(z.string(), z.unknown()).default({}),
});

/** Site-wide and per-IP ceilings over a rolling hour. Generous for humans on
 * a small-business site; a wall for scripted floods. */
const SITE_HOURLY_LIMIT = 30;
const IP_HOURLY_LIMIT = 5;

interface FormsSettings {
  notifyEmail?: string;
}

function formsSettings(settings: unknown): FormsSettings {
  if (typeof settings !== "object" || settings === null) return {};
  const forms = (settings as Record<string, unknown>).forms;
  if (typeof forms !== "object" || forms === null) return {};
  const notifyEmail = (forms as Record<string, unknown>).notifyEmail;
  return typeof notifyEmail === "string" ? { notifyEmail } : {};
}

async function sendNotification(
  siteName: string,
  notifyEmail: string,
  data: z.infer<typeof submission>,
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY not configured" };

  const from = process.env.FORMS_FROM_EMAIL ?? "Fable CMS <onboarding@resend.dev>";
  const lines = [
    `New enquiry via ${siteName}${data.pageSlug ? ` (${data.pageSlug})` : ""}`,
    "",
    `Name:  ${data.name}`,
    `Email: ${data.email}`,
    ...(data.phone ? [`Phone: ${data.phone}`] : []),
    "",
    data.message,
  ];
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [notifyEmail],
        reply_to: data.email,
        subject: `New enquiry from ${data.name} — ${siteName}`,
        text: lines.join("\n"),
      }),
    });
    if (!response.ok) {
      return { sent: false, reason: `Resend responded ${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "send failed" };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteSlug: string }> },
) {
  const { siteSlug } = await params;
  const supabase = serviceClient();
  const auth = await authenticateSiteRequest(supabase, request, siteSlug);
  if (!auth.site) {
    return auth.status === 500
      ? NextResponse.json({ error: "Internal error" }, { status: 500 })
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const site = auth.site;

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

  // Rolling-hour rate limits, DB-count based (no extra infra; survives restarts).
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: siteCount, error: siteCountError } = await supabase
    .from("form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("site_id", site.id)
    .gte("created_at", hourAgo);
  if (siteCountError) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if ((siteCount ?? 0) >= SITE_HOURLY_LIMIT) {
    return NextResponse.json({ error: "Too many submissions" }, { status: 429 });
  }

  const ip = typeof data.meta.ip === "string" ? data.meta.ip : null;
  if (ip) {
    const { count: ipCount } = await supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("site_id", site.id)
      .eq("meta->>ip", ip)
      .gte("created_at", hourAgo);
    if ((ipCount ?? 0) >= IP_HOURLY_LIMIT) {
      return NextResponse.json({ error: "Too many submissions" }, { status: 429 });
    }
  }

  const { data: row, error: insertError } = await supabase
    .from("form_submissions")
    .insert({
      site_id: site.id,
      page_slug: data.pageSlug ?? null,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      message: data.message,
      spam: data.spam,
      meta: data.meta as Json,
    })
    .select("id")
    .single();
  if (insertError) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // Notify after persisting; failures are recorded on the row, never fatal.
  const { notifyEmail } = formsSettings(site.settings);
  if (notifyEmail && !data.spam) {
    const emailResult = await sendNotification(site.name, notifyEmail, data);
    await supabase
      .from("form_submissions")
      .update({ meta: { ...data.meta, email: emailResult } as Json })
      .eq("id", row.id);
    if (!emailResult.sent && emailResult.reason !== "RESEND_API_KEY not configured") {
      console.error(`[forms] notification failed for ${siteSlug}: ${emailResult.reason}`);
      Sentry.captureMessage(
        `forms: notification email failed for ${siteSlug}: ${emailResult.reason}`,
        "error",
      );
    }
  }

  return NextResponse.json({ ok: true, id: row.id });
}
