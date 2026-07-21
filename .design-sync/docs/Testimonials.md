---
category: marketing
---
Grid of client quotes with attribution. 1–9 items, each `{quote, author, role}` (`role` optional, e.g. "Owner, Fern Café"). Renders as cards on the alternate surface color.

```tsx
import { Testimonials } from "@fable/sections";

<Testimonials
  heading="What clients say"
  items={[
    { quote: "They rebuilt our site in three weeks and bookings doubled.", author: "Maya Chen", role: "Owner, Fern Café" },
    { quote: "The first agency that actually understood our trade.", author: "Piet Botha", role: "Botha Electrical" },
  ]}
/>
```
