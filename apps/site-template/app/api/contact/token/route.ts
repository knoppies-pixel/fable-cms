import { NextResponse } from "next/server";
import { formTokenSecret, signFormToken } from "@/lib/form-token";

export const dynamic = "force-dynamic";

/**
 * Issues an HMAC-signed interaction token for the contact form. The form
 * fetches one on mount and returns it with the submission; /api/contact
 * verifies the signature and uses the embedded timestamp as a time trap
 * (instant submits are bots, valid signatures prove the page was loaded).
 */
export async function GET() {
  const secret = formTokenSecret();
  if (!secret) {
    // Unconfigured (bare local clone): the contact route skips the check too.
    return NextResponse.json({ token: null });
  }
  return NextResponse.json({ token: signFormToken(Date.now(), secret) });
}
