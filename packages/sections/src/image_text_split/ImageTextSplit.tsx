import { CmsImage } from "../lib/CmsImage";
import { RichText } from "../lib/richtext";
import { SectionShell } from "../lib/SectionShell";
import { Reveal } from "../lib/animations/Reveal";
import type { ImageTextSplitProps } from ".";

export function ImageTextSplit({
  heading,
  headingAccent,
  body,
  image,
  imagePosition,
  cta,
  depth,
  edge,
}: ImageTextSplitProps) {
  return (
    <SectionShell edge={edge}>
      {/* The one two-beat entrance in the system: text, then image, 80ms apart. */}
      <Reveal preset="staggerReveal" targets=":scope > div > div">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          <div className={imagePosition === "left" ? "md:order-2" : ""}>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {heading}
              {headingAccent && (
                <>
                  {" "}
                  <em className="italic text-accent">{headingAccent}</em>
                </>
              )}
            </h2>
            <RichText doc={body} className="mt-5 space-y-4 text-muted" />
            {cta && (
              <a
                href={cta.href}
                className="mt-7 inline-block rounded-btn bg-accent px-6 py-2.5 font-semibold text-accent-contrast transition-opacity hover:opacity-90"
              >
                {cta.label}
              </a>
            )}
          </div>
          <div
            className={`relative ${imagePosition === "left" ? "md:order-1" : ""} ${
              depth === "escape" ? "md:translate-y-8" : ""
            }`}
          >
            <CmsImage
              image={image}
              sizes="(min-width: 768px) 50vw, 100vw"
              className={`w-full rounded-card object-cover ${
                depth === "escape" ? "shadow-xl" : ""
              }`}
            />
          </div>
        </div>
      </Reveal>
    </SectionShell>
  );
}
