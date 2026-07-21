import { Testimonials } from "@fable/sections";

export function ThreeQuotes() {
  return (
    <Testimonials
      heading="What clients say"
      items={[
        {
          quote: "They rebuilt our site in three weeks and online bookings doubled the first month.",
          author: "Maya Chen",
          role: "Owner, Fern Café",
        },
        {
          quote: "The first agency that actually understood how a trade business wins work.",
          author: "Piet Botha",
          role: "Botha Electrical",
        },
        {
          quote: "Editing our own content without calling a developer has changed everything.",
          author: "Lindiwe Dlamini",
          role: "Marketing lead, Corvid Legal",
        },
      ]}
    />
  );
}

export function SingleQuote() {
  return (
    <Testimonials
      heading=""
      items={[
        {
          quote: "Straightforward, fast, and the site just works. We send every partner their way.",
          author: "Jonas Meyer",
          role: "COO, Harbourline Logistics",
        },
      ]}
    />
  );
}
