import { NextResponse } from "next/server";
import { z } from "zod";

const submission = z.object({
  name: z.string().min(1).max(120),
  email: z.email().max(200),
  phone: z.string().max(40).optional(),
  message: z.string().min(1).max(4000),
  /** Honeypot — humans never see this field; bots fill it. */
  website: z.string().optional(),
});

/**
 * Contact form endpoint. v1 validates + logs; persistence to a
 * form_submissions table and Resend notification land with the admin CRUD
 * phase (see DECISIONS.md, Phase 2).
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
  // Honeypot tripped: pretend success so the bot learns nothing.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  console.log(
    `[contact] ${new Date().toISOString()} from=${parsed.data.email} name=${parsed.data.name}`,
  );
  return NextResponse.json({ ok: true });
}
