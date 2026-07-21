import { ContactForm } from "@fable/sections";

export function Default() {
  return (
    <ContactForm
      heading="Get in touch"
      intro="Tell us a little about your project and we'll reply within one business day."
      showPhone={false}
      submitLabel="Send message"
      successMessage="Thanks — we'll get back to you shortly."
    />
  );
}

export function WithPhoneCustomLabels() {
  return (
    <ContactForm
      heading="Book a free consultation"
      intro="Prefer a call? Leave your number and our studio lead will ring you back."
      showPhone={true}
      submitLabel="Request callback"
      successMessage="Booked — expect a call from us within 24 hours."
    />
  );
}
