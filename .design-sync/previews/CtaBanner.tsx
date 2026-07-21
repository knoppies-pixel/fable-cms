import { CtaBanner } from "@fable/sections";

export function Accent() {
  return (
    <CtaBanner
      heading="Ready to get started?"
      body="Tell us about your project and we'll get back to you within a day."
      cta={{ label: "Contact us", href: "/contact" }}
      variant="accent"
    />
  );
}

export function Subtle() {
  return (
    <CtaBanner
      heading="See our work in person"
      body="Visit the studio any weekday — coffee's on us."
      cta={{ label: "Book a visit", href: "/visit" }}
      variant="subtle"
    />
  );
}

export function HeadingOnly() {
  return (
    <CtaBanner
      heading="Join our newsletter for monthly updates"
      body=""
      cta={{ label: "Subscribe", href: "/newsletter" }}
      variant="accent"
    />
  );
}
