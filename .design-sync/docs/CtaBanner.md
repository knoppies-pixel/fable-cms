---
category: marketing
---
Full-width call-to-action band with a button. Variants: `accent` (default — brand accent background, contrast text; high emphasis) and `subtle` (alternate surface background; low emphasis). Typically placed near the end of a page, before the footer.

```tsx
import { CtaBanner } from "@fable/sections";

<CtaBanner
  heading="Ready to get started?"
  body="Tell us about your project and we'll get back to you within a day."
  cta={{ label: "Contact us", href: "/contact" }}
  variant="accent"
/>
```
