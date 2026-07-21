import { CmsImage } from "../lib/CmsImage";
import { SectionShell } from "../lib/SectionShell";
import { Reveal } from "../lib/animations/Reveal";
import type { LogoStripProps } from ".";

export function LogoStrip({ heading, logos, grayscale, edge }: LogoStripProps) {
  return (
    <SectionShell edge={edge}>
      {heading && (
        <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          {heading}
        </p>
      )}
      <Reveal preset="staggerReveal" targets="li" stagger={0.06}>
        <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
          {logos.map((logo, i) => (
            <li key={i}>
              <CmsImage
                image={logo}
                sizes="160px"
                className={`h-10 w-auto object-contain transition-[filter,opacity] duration-200 ${
                  grayscale
                    ? "opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
                    : ""
                }`}
              />
            </li>
          ))}
        </ul>
      </Reveal>
    </SectionShell>
  );
}
