import { CmsImage } from "../lib/CmsImage";
import { RichText } from "../lib/richtext";
import { SectionShell } from "../lib/SectionShell";
import type { ImageTextSplitProps } from ".";

export function ImageTextSplit({
  heading,
  body,
  image,
  imagePosition,
  cta,
}: ImageTextSplitProps) {
  return (
    <SectionShell>
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div className={imagePosition === "left" ? "md:order-2" : ""}>
          <h2 className="text-3xl font-bold tracking-tight">{heading}</h2>
          <RichText doc={body} className="mt-5 space-y-4 text-muted" />
          {cta && (
            <a
              href={cta.href}
              className="mt-7 inline-block rounded-btn bg-accent px-5 py-2.5 font-semibold text-accent-contrast transition-opacity hover:opacity-90"
            >
              {cta.label}
            </a>
          )}
        </div>
        <CmsImage
          image={image}
          sizes="(min-width: 768px) 50vw, 100vw"
          className={`w-full rounded-card object-cover ${
            imagePosition === "left" ? "md:order-1" : ""
          }`}
        />
      </div>
    </SectionShell>
  );
}
