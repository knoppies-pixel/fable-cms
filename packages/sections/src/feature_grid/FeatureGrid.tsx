import { SectionShell } from "../lib/SectionShell";
import type { FeatureGridProps } from ".";

const columnClasses: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function FeatureGrid({
  eyebrow,
  heading,
  intro,
  items,
  columns,
}: FeatureGridProps) {
  return (
    <SectionShell background="alt">
      {(eyebrow || heading || intro) && (
        <div className="mx-auto mb-12 max-w-2xl text-center">
          {eyebrow && (
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">
              {eyebrow}
            </p>
          )}
          {heading && (
            <h2 className="mt-2 text-3xl font-bold tracking-tight">{heading}</h2>
          )}
          {intro && <p className="mt-4 text-muted">{intro}</p>}
        </div>
      )}
      <ul
        className={`grid gap-6 ${columnClasses[columns] ?? "sm:grid-cols-2 lg:grid-cols-3"}`}
      >
        {items.map((item, i) => (
          <li key={i} className="rounded-card bg-surface p-6 shadow-sm">
            <h3 className="text-lg font-semibold">{item.title}</h3>
            {item.description && (
              <p className="mt-2 leading-relaxed text-muted">{item.description}</p>
            )}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
