import { SectionShell } from "../lib/SectionShell";
import { FoamDots } from "../lib/FoamDots";
import { Reveal } from "../lib/animations/Reveal";
import type { FeatureGridProps } from ".";

const columnClasses: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

const cardClass = {
  light: "bg-surface shadow-sm",
  ink: "bg-surface/[0.07] ring-1 ring-surface/15",
} as const;

export function FeatureGrid({
  eyebrow,
  heading,
  intro,
  items,
  columns,
  background,
  ornament,
  edge,
}: FeatureGridProps) {
  const tone = background === "ink" ? "ink" : "light";
  return (
    <SectionShell background={background} edge={edge}>
      <div className="relative">
        {ornament && <FoamDots className="-top-8 right-0 h-28 w-48" />}
        {(eyebrow || heading || intro) && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                {eyebrow}
              </p>
            )}
            {heading && (
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {heading}
              </h2>
            )}
            {intro && <p className="mt-4 text-muted">{intro}</p>}
          </div>
        )}
        <Reveal preset="staggerReveal" targets="li">
          <ul
            className={`grid gap-6 ${columnClasses[columns] ?? "sm:grid-cols-2 lg:grid-cols-3"}`}
          >
            {items.map((item, i) => (
              <li key={i} className={`rounded-card p-6 ${cardClass[tone]}`}>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                {item.description && (
                  <p className="mt-2 leading-relaxed text-muted">
                    {item.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </SectionShell>
  );
}
