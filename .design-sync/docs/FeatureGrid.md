---
category: marketing
---
Grid of feature or service cards with title and description. `columns` is 2–4 (default 3); the grid collapses to one column on mobile. Optional `eyebrow` (small accent-colored label above the heading) and `intro` paragraph.

1–12 items, each `{title, description}`. No icons or images — the cards are typographic.

```tsx
import { FeatureGrid } from "@fable/sections";

<FeatureGrid
  eyebrow="Services"
  heading="What we do"
  intro="Everything a small business needs to look sharp online."
  columns={3}
  items={[
    { title: "Brand sites", description: "Fast marketing sites that stay easy to update." },
    { title: "E-commerce", description: "Storefronts that convert without the bloat." },
    { title: "SEO", description: "Technical and content SEO baked in from day one." },
  ]}
/>
```
