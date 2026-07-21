# Building with @fable/sections

These are full-width **page sections** (marketing-site bands), not atomic controls. Build pages by stacking sections vertically in order — `Hero` → content sections → `CtaBanner` → `ContactForm` is the canonical page shape.

## Setup: media must be registered first

Sections take image refs as `{ mediaId: string, alt?: string }`, resolved through a media store. Call `registerMedia` **at module top, before any render** — an unregistered `mediaId` renders nothing (no error, the image is silently absent):

```tsx
import { registerMedia, Hero, FeatureGrid } from "@fable/sections";

registerMedia([
  { id: "hero-1", url: "<image url or data-URI>", alt: "Studio at work", width: 1200, height: 900 },
]);

<Hero heading="Design that ships" subheading="Fast, accessible marketing sites."
      cta={{ label: "Start a project", href: "/contact" }}
      image={{ mediaId: "hero-1", alt: "" }} variant="split" />
```

Rich-text props (`RichTextSection.body`, FAQ answers) take a doc object, not a string: `textDoc("Para one.", "Para two.")` for plain paragraphs, or a `RichTextDoc` node tree (`{type: "doc", content: [{type: "heading", level: 2, ...}]}`) for headings/lists/quotes — see `RichText.d.ts`.

## Styling: props, not classes

Every section wraps itself in `SectionShell` (vertical rhythm `py-16 sm:py-20`, `max-w-6xl` container, band background). **Never add outer padding, margins, or width constraints around a section** — stack them edge-to-edge; alternate `background="alt"`/`"accent"` on adjacent sections for banding.

The shipped stylesheet is a **purged** Tailwind build: only classes the sections themselves use exist. Do not write arbitrary Tailwind utilities in your own glue markup — they will not resolve. Instead:

- Style through section props: `variant`, `background` (`"surface" | "alt" | "accent"`), `width` (`"default" | "narrow" | "full"`), `columns` (2 | 3 | 4), `grayscale`, per-component enums in each `.d.ts`.
- For your own glue elements, these token classes exist and are safe: `bg-surface`, `bg-surface-alt`, `bg-accent`, `text-primary`, `text-muted`, `text-accent`, `text-accent-contrast`, `rounded-card`, `rounded-btn`, plus common layout used by sections (`flex`, `grid`, `gap-4`/`gap-6`, `items-center`, `justify-center`).
- Anything else: inline styles referencing the theme variables — `var(--color-surface)`, `var(--color-surface-alt)`, `var(--color-primary)`, `var(--color-muted)`, `var(--color-accent)`, `var(--color-accent-contrast)`, `var(--radius-card)`, `var(--radius-btn)`.

Theming is **token-driven**: sites override the `--color-*` / `--radius-*` variables on `:root`; components never hard-code colors. Keep that contract — express color only via tokens.

## Where the truth lives

- `styles.css` → imports `_ds_bundle.css` (compiled utilities + `:root` token defaults) — read it before styling custom markup.
- Each component's `<Name>.d.ts` is the exact prop contract; its `<Name>.prompt.md` shows composed usage.
- `SectionShell`, `CmsImage`, `RichText` (primitives group) are the shared building blocks if you need a custom section: `SectionShell` for the band, `CmsImage` for media-store images, `RichText` for doc rendering.
