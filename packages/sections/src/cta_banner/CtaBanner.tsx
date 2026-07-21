import { SectionShell } from "../lib/SectionShell";
import { FoamDots } from "../lib/FoamDots";
import { Reveal } from "../lib/animations/Reveal";
import type { CtaBannerProps } from ".";

const bands = {
  accent: "accent",
  subtle: "alt",
  ink: "ink",
} as const;

export function CtaBanner({
  heading,
  headingAccent,
  body,
  cta,
  variant,
  ornament,
  edge,
}: CtaBannerProps) {
  const accent = variant === "accent";
  return (
    <SectionShell background={bands[variant]} edge={edge}>
      <div className="relative">
        {ornament && (
          <FoamDots
            color={
              accent ? "var(--color-accent-contrast)" : "var(--color-accent-warm)"
            }
            className="-bottom-8 -left-4 h-28 w-44"
          />
        )}
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {heading}
            {headingAccent && (
              <>
                {" "}
                <em className={accent ? "italic" : "italic text-accent"}>
                  {headingAccent}
                </em>
              </>
            )}
          </h2>
          {body && (
            <p className={`mt-4 text-lg ${accent ? "opacity-90" : "text-muted"}`}>
              {body}
            </p>
          )}
          {cta && (
            <a
              href={cta.href}
              className={`mt-8 inline-block rounded-btn px-7 py-3 font-semibold transition-opacity hover:opacity-90 ${
                accent
                  ? "bg-surface text-primary"
                  : "bg-accent text-accent-contrast"
              }`}
            >
              {cta.label}
            </a>
          )}
        </Reveal>
      </div>
    </SectionShell>
  );
}
