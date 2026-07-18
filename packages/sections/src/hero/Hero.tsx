import { CmsImage } from "../lib/CmsImage";
import { SectionShell } from "../lib/SectionShell";
import type { HeroProps } from ".";

function CtaButton({ cta }: { cta: HeroProps["cta"] }) {
  if (!cta) return null;
  return (
    <a
      href={cta.href}
      className="inline-block rounded-btn bg-accent px-6 py-3 font-semibold text-accent-contrast transition-opacity hover:opacity-90"
    >
      {cta.label}
    </a>
  );
}

export function Hero({ heading, subheading, cta, image, variant }: HeroProps) {
  if (variant === "full-bleed") {
    return (
      <SectionShell width="full" padded={false}>
        <div className="relative flex min-h-[70dvh] items-center justify-center overflow-hidden">
          <CmsImage
            image={image}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-primary/60" aria-hidden="true" />
          <div className="relative mx-auto max-w-3xl px-4 py-24 text-center text-surface">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              {heading}
            </h1>
            {subheading && (
              <p className="mt-5 text-lg leading-relaxed opacity-90">{subheading}</p>
            )}
            {cta && (
              <div className="mt-8">
                <CtaButton cta={cta} />
              </div>
            )}
          </div>
        </div>
      </SectionShell>
    );
  }

  if (variant === "split") {
    return (
      <SectionShell>
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          <div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              {heading}
            </h1>
            {subheading && (
              <p className="mt-5 text-lg leading-relaxed text-muted">{subheading}</p>
            )}
            {cta && (
              <div className="mt-8">
                <CtaButton cta={cta} />
              </div>
            )}
          </div>
          <CmsImage
            image={image}
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="w-full rounded-card object-cover"
          />
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell>
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{heading}</h1>
        {subheading && (
          <p className="mt-5 text-lg leading-relaxed text-muted">{subheading}</p>
        )}
        {cta && (
          <div className="mt-8">
            <CtaButton cta={cta} />
          </div>
        )}
      </div>
      {image && (
        <div className="mx-auto mt-12 max-w-4xl">
          <CmsImage
            image={image}
            priority
            sizes="(min-width: 1024px) 896px, 100vw"
            className="w-full rounded-card object-cover"
          />
        </div>
      )}
    </SectionShell>
  );
}
