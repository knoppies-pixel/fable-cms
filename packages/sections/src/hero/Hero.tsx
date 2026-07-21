import { CmsImage } from "../lib/CmsImage";
import { SectionShell } from "../lib/SectionShell";
import { Reveal } from "../lib/animations/Reveal";
import type { HeroProps } from ".";

function CtaButton({ cta }: { cta: HeroProps["cta"] }) {
  if (!cta) return null;
  return (
    <a
      href={cta.href}
      className="inline-block rounded-btn bg-accent px-7 py-3 font-semibold text-accent-contrast transition-opacity hover:opacity-90"
    >
      {cta.label}
    </a>
  );
}

function Heading({
  heading,
  headingAccent,
  className,
}: Pick<HeroProps, "heading" | "headingAccent"> & { className: string }) {
  return (
    <h1 className={`font-display font-semibold tracking-tight ${className}`}>
      {heading}
      {headingAccent && (
        <>
          {" "}
          <em className="italic text-accent">{headingAccent}</em>
        </>
      )}
    </h1>
  );
}

export function Hero({
  heading,
  headingAccent,
  subheading,
  cta,
  image,
  variant,
  edge,
}: HeroProps) {
  if (variant === "full-bleed") {
    /* The float move (design/DIRECTION.md — depth): a paper card over
     * full-bleed media carries the contrast; no dark overlay. */
    return (
      <SectionShell width="full" padded={false} edge={edge}>
        <div className="relative flex min-h-[70dvh] items-center justify-center overflow-hidden">
          <CmsImage
            image={image}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <Reveal className="relative px-4 py-24">
            <div className="mx-auto max-w-2xl rounded-card bg-surface p-8 text-center text-primary shadow-2xl sm:p-12">
              <Heading
                heading={heading}
                headingAccent={headingAccent}
                className="text-4xl leading-[1.05] sm:text-5xl"
              />
              {subheading && (
                <p className="mt-5 text-lg leading-relaxed text-muted">
                  {subheading}
                </p>
              )}
              {cta && (
                <div className="mt-8">
                  <CtaButton cta={cta} />
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </SectionShell>
    );
  }

  if (variant === "split") {
    return (
      <SectionShell edge={edge}>
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          <Reveal>
            <Heading
              heading={heading}
              headingAccent={headingAccent}
              className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl"
            />
            {subheading && (
              <p className="mt-5 text-lg leading-relaxed text-muted">
                {subheading}
              </p>
            )}
            {cta && (
              <div className="mt-8">
                <CtaButton cta={cta} />
              </div>
            )}
          </Reveal>
          {/* Restrained escape: the media dips toward the band's bottom edge. */}
          <div className="relative md:translate-y-8">
            <CmsImage
              image={image}
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="w-full rounded-card object-cover shadow-xl"
            />
          </div>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell edge={edge}>
      <Reveal className="mx-auto max-w-3xl text-center">
        <Heading
          heading={heading}
          headingAccent={headingAccent}
          className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl"
        />
        {subheading && (
          <p className="mt-5 text-lg leading-relaxed text-muted">
            {subheading}
          </p>
        )}
        {cta && (
          <div className="mt-8">
            <CtaButton cta={cta} />
          </div>
        )}
      </Reveal>
      {image && (
        <div className="mx-auto mt-12 max-w-4xl">
          <CmsImage
            image={image}
            priority
            sizes="(min-width: 1024px) 896px, 100vw"
            className="w-full rounded-card object-cover shadow-xl"
          />
        </div>
      )}
    </SectionShell>
  );
}
