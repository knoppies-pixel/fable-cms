---
category: content
---
Expandable question-and-answer list (native `<details>` elements — works without JavaScript). 1–20 items, each `{question, answer}`. Answers are plain text; blank lines split paragraphs.

```tsx
import { FaqAccordion } from "@fable/sections";

<FaqAccordion
  heading="Frequently asked questions"
  items={[
    { question: "How long does a site take?", answer: "Most sites launch in two to four weeks." },
    { question: "Can we edit content ourselves?", answer: "Yes — everything lives in the CMS admin.\n\nNo deploys needed for copy changes." },
  ]}
/>
```
