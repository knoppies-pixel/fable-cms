import { CmsImage } from "../lib/CmsImage";
import { SectionShell } from "../lib/SectionShell";
import type { GalleryProps } from ".";

const columnClasses: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function Gallery({ heading, images, columns }: GalleryProps) {
  return (
    <SectionShell>
      {heading && (
        <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">
          {heading}
        </h2>
      )}
      <ul
        className={`grid gap-4 ${columnClasses[columns] ?? "sm:grid-cols-2 lg:grid-cols-3"}`}
      >
        {images.map((image, i) => (
          <li
            key={i}
            className="relative aspect-[4/3] overflow-hidden rounded-card bg-surface-alt"
          >
            <CmsImage
              image={image}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
