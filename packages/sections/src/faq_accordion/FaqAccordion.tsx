import { SectionShell } from "../lib/SectionShell";
import { Reveal } from "../lib/animations/Reveal";
import type { FaqAccordionProps } from ".";

/**
 * Native <details>/<summary> accordion: works without JavaScript, stays a
 * server component, and is keyboard-accessible for free.
 */
export function FaqAccordion({ heading, items, edge }: FaqAccordionProps) {
  return (
    <SectionShell background="alt" width="narrow" edge={edge}>
      {heading && (
        <h2 className="mb-10 text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {heading}
        </h2>
      )}
      <Reveal preset="staggerReveal" targets="details" className="space-y-3">
        {items.map((item, i) => (
          <details
            key={i}
            className="group rounded-card border border-primary/10 bg-surface px-6 py-4 shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
              {item.question}
              <span
                aria-hidden="true"
                className="text-accent transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">
              {item.answer}
            </p>
          </details>
        ))}
      </Reveal>
    </SectionShell>
  );
}
