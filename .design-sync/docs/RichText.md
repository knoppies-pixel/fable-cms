---
category: primitives
---
Server-side renderer for the CMS's rich text documents (Tiptap-style JSON). Covers paragraph, heading, bullet/ordered lists, blockquote, hardBreak, and text with bold/italic/link marks; unknown node types render their children instead of failing. Build simple docs with `textDoc(...paragraphs)`.

Usually consumed through `RichTextSection` or `ImageTextSplit` rather than directly.

```tsx
import { RichText, textDoc } from "@fable/sections";

<RichText doc={textDoc("First paragraph.", "Second paragraph.")} />
```
