---
category: forms
---
Name/email/message form posting to the site's contact endpoint (`/api/contact`). Client component with inline validation, a pending state, and a success message that replaces the form. `showPhone` adds an optional phone field; `submitLabel` and `successMessage` are customizable.

Use one per page at most, usually on the contact page under a Hero or heading section.

```tsx
import { ContactForm } from "@fable/sections";

<ContactForm
  heading="Get in touch"
  intro="Tell us a little about your project."
  showPhone
  submitLabel="Send message"
  successMessage="Thanks — we'll get back to you shortly."
/>
```
