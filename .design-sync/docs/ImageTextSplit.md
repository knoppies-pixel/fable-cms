---
category: content
---
Two-column section: rich text beside an image. `imagePosition` is `right` (default) or `left`; columns stack on mobile with the image first. `body` is a rich text doc (use `textDoc(...)`), `cta` is `{label, href}` or `null`, and `image` is a media ref `{mediaId, alt}` — register it with `registerMedia([...])` first.

Alternate `imagePosition` when stacking several of these on one page.

```tsx
import { ImageTextSplit, registerMedia, textDoc } from "@fable/sections";

registerMedia([{ id: "m2", url: "/photos/workshop.jpg", alt: "", width: 1200, height: 900 }]);

<ImageTextSplit
  heading="Built around your workflow"
  body={textDoc("Content lives in the CMS, so your team edits copy without a deploy.")}
  image={{ mediaId: "m2", alt: "Workshop table with laptops" }}
  imagePosition="left"
  cta={{ label: "See how it works", href: "/process" }}
/>
```
