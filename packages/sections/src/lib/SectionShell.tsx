import type { CSSProperties, ReactNode } from "react";
import type { Edge } from "./band";

/**
 * Shared outer wrapper for every section: vertical rhythm, horizontal
 * container, band background, bottom edge. Sections never set their own outer
 * padding (CLAUDE.md styling rules) — variants here are the only knobs.
 * Band system per design/DIRECTION.md (Refined Coastal).
 */
const backgrounds = {
  surface: "bg-surface",
  alt: "bg-surface-alt",
  accent: "bg-accent text-accent-contrast",
  ink: "bg-surface-ink text-primary",
} as const;

type Background = keyof typeof backgrounds;

/*
 * Ink bands re-scope the text tokens so section internals keep using the same
 * token classes on dark ground — no per-section forks. accent-contrast flips
 * to ink so accent-soft buttons carry dark text (7.8:1 measured).
 */
const inkVars = {
  "--color-primary": "var(--color-surface)",
  "--color-muted": "var(--color-on-ink)",
  "--color-accent": "var(--color-accent-soft)",
  "--color-accent-contrast": "var(--color-surface-ink)",
} as CSSProperties;

const widths = {
  default: "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8",
  narrow: "mx-auto w-full max-w-3xl px-4 sm:px-6",
  full: "w-full",
} as const;

/* Edge shapes are drawn in the section's own ground color, dipping into the
 * band below — self-contained, no knowledge of the next section needed. */
const edgePaths: Record<Exclude<Edge, "none" | "foam">, string> = {
  tide: "M0 0 L1440 0 L1440 32 C 1200 58, 960 10, 720 36 C 480 62, 240 8, 0 40 Z",
  swell: "M0 0 L1440 0 C 960 68, 480 68, 0 0 Z",
  shore: "M0 0 L1440 0 L1440 14 L0 52 Z",
};

const edgeColors: Record<Background, string> = {
  surface: "var(--color-surface)",
  alt: "var(--color-surface-alt)",
  accent: "var(--color-accent)",
  ink: "var(--color-surface-ink)",
};

export function SectionShell({
  children,
  background = "surface",
  width = "default",
  padded = true,
  edge = "none",
}: {
  children: ReactNode;
  background?: Background;
  width?: keyof typeof widths;
  /** false only for full-bleed sections that manage their own inner spacing. */
  padded?: boolean;
  edge?: Edge;
}) {
  const style: CSSProperties | undefined =
    background === "ink" ? inkVars : undefined;

  return (
    <section
      className={`${backgrounds[background]}${edge !== "none" ? " relative" : ""}`}
      style={style}
    >
      <div className={`${widths[width]} ${padded ? "py-16 sm:py-20" : ""}`}>
        {children}
      </div>
      {edge !== "none" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-full z-10"
          style={
            {
              height: "clamp(2.5rem, 5vw, 4.5rem)",
              "--edge-c": edgeColors[background],
            } as CSSProperties
          }
        >
          {edge === "foam" ? (
            <div
              className="h-full w-full"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 7px 7px, var(--edge-c) 2.6px, transparent 3.2px)",
                backgroundSize: "30px 15px",
                WebkitMaskImage: "linear-gradient(#000 10%, transparent 92%)",
                maskImage: "linear-gradient(#000 10%, transparent 92%)",
              }}
            />
          ) : (
            <svg
              className="h-full w-full"
              viewBox="0 0 1440 72"
              preserveAspectRatio="none"
            >
              <path fill="var(--edge-c)" d={edgePaths[edge]} />
            </svg>
          )}
        </div>
      )}
    </section>
  );
}
