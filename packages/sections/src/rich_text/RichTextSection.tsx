import { RichText } from "../lib/richtext";
import { SectionShell } from "../lib/SectionShell";
import { Reveal } from "../lib/animations/Reveal";
import type { RichTextSectionProps } from ".";

export function RichTextSection({ body, width, edge }: RichTextSectionProps) {
  return (
    <SectionShell width={width === "narrow" ? "narrow" : "default"} edge={edge}>
      <Reveal>
        <RichText doc={body} className="space-y-5" />
      </Reveal>
    </SectionShell>
  );
}
