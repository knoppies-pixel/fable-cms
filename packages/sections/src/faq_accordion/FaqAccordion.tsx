import { SectionShell } from "../lib/SectionShell";
import type { FaqAccordionProps } from ".";

/**
 * Native <details>/<summary> accordion: works without JavaScript, stays a
 * server component, and is keyboard-accessible for free.
 */
export function FaqAccordion({ heading, items }: FaqAccordionProps) {
  return (
    <SectionShell width="narrow">
      {heading && (
        <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">
          {heading}
        </h2>
      )}
      <div className="divide-y divide-surface-alt rounded-card border border-surface-alt">
        {items.map((item, i) => (
          <details key={i} className="group px-6 py-4">
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
      </div>
    </SectionShell>
  );
}
