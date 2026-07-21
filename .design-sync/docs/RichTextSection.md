---
category: content
---
Free-form formatted text: headings, lists, links, quotes. `body` is a Tiptap-style rich text document; build one with the exported `textDoc(...paragraphs)` helper for plain paragraphs, or pass a full doc with `heading`/`bulletList`/`orderedList`/`blockquote` nodes and `bold`/`italic`/`link` marks. `width` is `narrow` (default, comfortable prose measure) or `normal`.

```tsx
import { RichTextSection, textDoc } from "@fable/sections";

<RichTextSection
  width="narrow"
  body={textDoc(
    "We started in 2019 with one belief: small businesses deserve great websites.",
    "Today we've shipped over forty sites across hospitality, trades, and retail.",
  )}
/>
```
