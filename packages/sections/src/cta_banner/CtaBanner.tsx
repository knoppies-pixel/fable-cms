import { SectionShell } from "../lib/SectionShell";
import type { CtaBannerProps } from ".";

export function CtaBanner({ heading, body, cta, variant }: CtaBannerProps) {
  const accent = variant === "accent";
  return (
    <SectionShell background={accent ? "accent" : "alt"}>
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight">{heading}</h2>
        {body && (
          <p className={`mt-4 text-lg ${accent ? "opacity-90" : "text-muted"}`}>
            {body}
          </p>
        )}
        {cta && (
          <a
            href={cta.href}
            className={`mt-8 inline-block rounded-btn px-6 py-3 font-semibold transition-opacity hover:opacity-90 ${
              accent
                ? "bg-surface text-primary"
                : "bg-accent text-accent-contrast"
            }`}
          >
            {cta.label}
          </a>
        )}
      </div>
    </SectionShell>
  );
}
