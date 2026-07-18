import { SectionShell } from "../lib/SectionShell";
import type { TestimonialsProps } from ".";

export function Testimonials({ heading, items }: TestimonialsProps) {
  return (
    <SectionShell background="alt">
      {heading && (
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">
          {heading}
        </h2>
      )}
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <li key={i}>
            <figure className="flex h-full flex-col rounded-card bg-surface p-6 shadow-sm">
              <blockquote className="flex-1 leading-relaxed">
                “{item.quote}”
              </blockquote>
              <figcaption className="mt-4 border-t border-surface-alt pt-4">
                <span className="font-semibold">{item.author}</span>
                {item.role && (
                  <span className="block text-sm text-muted">{item.role}</span>
                )}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
