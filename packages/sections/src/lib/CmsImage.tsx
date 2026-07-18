import Image from "next/image";
import type { ImageRef } from "./refs";
import { resolveMedia } from "./media";

/**
 * The only way images render in sections (never raw <img>). Resolves the
 * media ref against the per-request media map; unresolvable refs render
 * nothing so a deleted media row can never break a page.
 */
export function CmsImage({
  image,
  className,
  sizes,
  priority = false,
  fill = false,
}: {
  image: ImageRef | null | undefined;
  className?: string;
  /** Passed to next/image; required for `fill`, recommended otherwise. */
  sizes?: string;
  priority?: boolean;
  /** Fill the nearest positioned ancestor instead of using intrinsic size. */
  fill?: boolean;
}) {
  if (!image) return null;
  const record = resolveMedia(image.mediaId);
  if (!record) return null;

  const alt = image.alt || record.alt;
  if (fill) {
    return (
      <Image
        src={record.url}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={className}
      />
    );
  }
  if (record.width == null || record.height == null) return null;
  return (
    <Image
      src={record.url}
      alt={alt}
      width={record.width}
      height={record.height}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}
