import { CmsImage } from "../lib/CmsImage";
import { SectionShell } from "../lib/SectionShell";
import { Reveal } from "../lib/animations/Reveal";
import type { TestimonialsProps } from ".";

/* Card surfaces differ by ground: paper cards on light bands, translucent
 * ink-tinted cards on ink (text colors arrive via the shell's token re-scope). */
const cardClass = {
  light: "bg-surface shadow-sm",
  ink: "bg-surface/[0.07] ring-1 ring-surface/15",
} as const;

const ruleClass = {
  light: "border-surface-alt",
  ink: "border-surface/15",
} as const;

export function Testimonials({
  heading,
  items,
  background,
  edge,
}: TestimonialsProps) {
  const tone = background === "ink" ? "ink" : "light";

  const item = items.length === 1 ? items[0] : undefined;
  if (item) {
    /* The pull-quote: one voice at display size, portrait escaping its color
     * field (design/DIRECTION.md — the escape move). */
    return (
      <SectionShell background={background} edge={edge}>
        <Reveal className="mx-auto max-w-4xl">
          <figure
            className={`relative rounded-card p-8 sm:p-12 ${cardClass[tone]} ${
              item.image ? "md:mr-20 md:pr-32" : ""
            }`}
          >
            <blockquote className="font-display text-2xl font-semibold italic leading-snug tracking-tight sm:text-3xl">
              “{item.quote}”
            </blockquote>
            <figcaption className="mt-6">
              <span className="font-semibold">{item.author}</span>
              {item.role && (
                <span className="mt-0.5 block text-sm font-semibold text-accent">
                  {item.role}
                </span>
              )}
            </figcaption>
            {item.image && (
              <div className="mt-8 md:absolute md:top-1/2 md:right-0 md:mt-0 md:translate-x-1/2 md:-translate-y-1/2">
                <CmsImage
                  image={item.image}
                  sizes="(min-width: 768px) 176px, 128px"
                  className="h-32 w-32 rounded-full object-cover shadow-xl ring-4 ring-surface/20 md:h-44 md:w-44"
                />
              </div>
            )}
          </figure>
        </Reveal>
      </SectionShell>
    );
  }

  return (
    <SectionShell background={background} edge={edge}>
      {heading && (
        <h2 className="mb-12 text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {heading}
        </h2>
      )}
      <Reveal preset="staggerReveal" targets="li">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <li key={i}>
              <figure
                className={`flex h-full flex-col rounded-card p-6 ${cardClass[tone]}`}
              >
                <blockquote className="flex-1 leading-relaxed">
                  “{item.quote}”
                </blockquote>
                <figcaption
                  className={`mt-4 flex items-center gap-3 border-t pt-4 ${ruleClass[tone]}`}
                >
                  {item.image && (
                    <CmsImage
                      image={item.image}
                      sizes="40px"
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  )}
                  <span>
                    <span className="font-semibold">{item.author}</span>
                    {item.role && (
                      <span className="block text-sm text-muted">
                        {item.role}
                      </span>
                    )}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Reveal>
    </SectionShell>
  );
}
