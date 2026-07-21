---
category: media
---
Responsive image grid. 1–24 images (media refs `{mediaId, alt}` — register records with `registerMedia([...])` first); `columns` is 2–4 (default 3), collapsing on mobile. Optional `heading`.

```tsx
import { Gallery, registerMedia } from "@fable/sections";

registerMedia([
  { id: "g1", url: "/photos/one.jpg", alt: "Storefront", width: 800, height: 600 },
  { id: "g2", url: "/photos/two.jpg", alt: "Interior", width: 800, height: 600 },
  { id: "g3", url: "/photos/three.jpg", alt: "Detail", width: 800, height: 600 },
]);

<Gallery
  heading="Recent work"
  columns={3}
  images={[
    { mediaId: "g1", alt: "" },
    { mediaId: "g2", alt: "" },
    { mediaId: "g3", alt: "" },
  ]}
/>
```
