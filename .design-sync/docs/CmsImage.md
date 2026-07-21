---
category: primitives
---
The only way images render in sections (never raw `<img>`). Takes a media ref `{mediaId, alt}`, resolves it against records previously registered with `registerMedia([...])`, and renders via `next/image`. Unresolvable refs render nothing — a deleted media row can never break a page.

- `fill`: fill the nearest positioned ancestor (pair with a sized, `relative` parent and `sizes`)
- Without `fill`, the registered record must include `width`/`height` or nothing renders
- `alt` on the ref overrides the record's alt; empty string falls back

```tsx
import { CmsImage, registerMedia } from "@fable/sections";

registerMedia([{ id: "m1", url: "/photos/team.jpg", alt: "The team", width: 1200, height: 800 }]);

<CmsImage image={{ mediaId: "m1", alt: "" }} sizes="(min-width: 768px) 50vw, 100vw" className="rounded-card" />
```
