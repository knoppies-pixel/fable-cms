---
category: marketing
---
Row of client or partner logos. 1–12 logos (media refs `{mediaId, alt}` — register records first). `grayscale` (default `true`) desaturates logos until hover for a calmer strip. Optional `heading` renders as a small muted label above.

```tsx
import { LogoStrip, registerMedia } from "@fable/sections";

registerMedia([
  { id: "l1", url: "/logos/acme.svg", alt: "Acme", width: 160, height: 48 },
  { id: "l2", url: "/logos/globex.svg", alt: "Globex", width: 160, height: 48 },
]);

<LogoStrip
  heading="Trusted by"
  grayscale
  logos={[
    { mediaId: "l1", alt: "" },
    { mediaId: "l2", alt: "" },
  ]}
/>
```
