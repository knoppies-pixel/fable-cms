import { CmsImage } from "../lib/CmsImage";
import { SectionShell } from "../lib/SectionShell";
import type { LogoStripProps } from ".";

export function LogoStrip({ heading, logos, grayscale }: LogoStripProps) {
  return (
    <SectionShell>
      {heading && (
        <p className="mb-8 text-center text-sm font-semibold uppercase tracking-wider text-muted">
          {heading}
        </p>
      )}
      <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
        {logos.map((logo, i) => (
          <li key={i}>
            <CmsImage
              image={logo}
              sizes="160px"
              className={`h-10 w-auto object-contain ${
                grayscale ? "opacity-60 grayscale" : ""
              }`}
            />
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
