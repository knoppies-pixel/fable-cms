---
category: headers
---
Top-of-page banner with heading, CTA, optional image. Three variants: `centered` (default — centered copy, optional image below), `split` (copy left, image right), `full-bleed` (image behind a dark overlay, light text, min 70dvh tall).

Use exactly one Hero per page, always first. `cta` is `{label, href}` or `null`; `image` is a media ref `{mediaId, alt}` or `null` — register the media record first with `registerMedia([...])`. The `full-bleed` and `split` variants need an image to look right; `centered` works well without one.

```tsx
import { Hero, registerMedia } from "@fable/sections";

registerMedia([{ id: "m1", url: "/photos/studio.jpg", alt: "Studio", width: 1600, height: 900 }]);

<Hero
  heading="Design that ships"
  subheading="A small studio building fast, accessible marketing sites."
  cta={{ label: "Start a project", href: "/contact" }}
  image={{ mediaId: "m1", alt: "" }}
  variant="split"
/>
```
