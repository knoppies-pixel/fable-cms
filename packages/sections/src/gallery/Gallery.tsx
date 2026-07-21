import { CmsImage } from "../lib/CmsImage";
import { SectionShell } from "../lib/SectionShell";
import { Reveal } from "../lib/animations/Reveal";
import type { GalleryProps } from ".";

const columnClasses: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function Gallery({ heading, images, columns, edge }: GalleryProps) {
  return (
    <SectionShell edge={edge}>
      {heading && (
        <h2 className="mb-10 text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {heading}
        </h2>
      )}
      <Reveal preset="staggerReveal" targets="li">
        <ul
          className={`grid gap-3 ${columnClasses[columns] ?? "sm:grid-cols-2 lg:grid-cols-3"}`}
        >
          {images.map((image, i) => (
            <li
              key={i}
              className="group relative aspect-[4/3] overflow-hidden rounded-card bg-surface-alt"
            >
              <CmsImage
                image={image}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              />
            </li>
          ))}
        </ul>
      </Reveal>
    </SectionShell>
  );
}
