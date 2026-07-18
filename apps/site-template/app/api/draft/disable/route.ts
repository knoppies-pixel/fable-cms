import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

/** Exits preview mode. Linked from the preview banner. */
export async function GET() {
  (await draftMode()).disable();
  redirect("/");
}
