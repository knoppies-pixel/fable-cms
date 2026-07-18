import type { ReactNode } from "react";

/**
 * Shared outer wrapper for every section: vertical rhythm, horizontal
 * container, band background. Sections never set their own outer padding
 * (CLAUDE.md styling rules) — variants here are the only knobs.
 */
const backgrounds = {
  surface: "bg-surface",
  alt: "bg-surface-alt",
  accent: "bg-accent text-accent-contrast",
} as const;

const widths = {
  default: "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8",
  narrow: "mx-auto w-full max-w-3xl px-4 sm:px-6",
  full: "w-full",
} as const;

export function SectionShell({
  children,
  background = "surface",
  width = "default",
  padded = true,
}: {
  children: ReactNode;
  background?: keyof typeof backgrounds;
  width?: keyof typeof widths;
  /** false only for full-bleed sections that manage their own inner spacing. */
  padded?: boolean;
}) {
  return (
    <section className={backgrounds[background]}>
      <div className={`${widths[width]} ${padded ? "py-16 sm:py-20" : ""}`}>
        {children}
      </div>
    </section>
  );
}
