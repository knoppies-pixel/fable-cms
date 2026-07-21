---
category: primitives
---
Shared outer wrapper for every section: vertical rhythm (`py-16 sm:py-20`), horizontal container, band background. Sections never set their own outer padding — these props are the only knobs. Every registry section already renders inside one; reach for it directly only when building custom page chrome that should match the sections' rhythm.

- `background`: `surface` (default) | `alt` (alternate band) | `accent` (brand band with contrast text)
- `width`: `default` (max-w-6xl) | `narrow` (max-w-3xl prose) | `full` (edge to edge)
- `padded`: set `false` only for full-bleed content that manages its own inner spacing

```tsx
import { SectionShell } from "@fable/sections";

<SectionShell background="alt" width="narrow">
  <h2 className="text-3xl font-bold tracking-tight">Custom band</h2>
</SectionShell>
```
