import { RichText } from "../lib/richtext";
import { SectionShell } from "../lib/SectionShell";
import type { RichTextSectionProps } from ".";

export function RichTextSection({ body, width }: RichTextSectionProps) {
  return (
    <SectionShell width={width === "narrow" ? "narrow" : "default"}>
      <RichText doc={body} className="space-y-5" />
    </SectionShell>
  );
}
