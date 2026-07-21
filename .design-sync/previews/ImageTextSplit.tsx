import { ImageTextSplit, registerMedia, textDoc } from "@fable/sections";

const svg = (w: number, h: number, from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/>` +
      `</linearGradient></defs><rect width='${w}' height='${h}' fill='url(#g)'/></svg>`,
  )}`;

registerMedia([
  { id: "split-workshop", url: svg(1200, 900, "#0e7490", "#0f2e35"), alt: "Team reviewing a layout in the studio", width: 1200, height: 900 },
  { id: "split-onsite", url: svg(1200, 900, "#155e63", "#0b2226"), alt: "Client walkthrough on site", width: 1200, height: 900 },
]);

export function ImageRight() {
  return (
    <ImageTextSplit
      heading="A process built for small teams"
      body={textDoc(
        "We start every project with a working session, not a questionnaire. You leave with a plan, not a PDF.",
        "From there we design, build, and hand over a CMS your team can actually run without calling us first.",
      )}
      image={{ mediaId: "split-workshop", alt: "" }}
      imagePosition="right"
      cta={{ label: "Book a working session", href: "/contact" }}
    />
  );
}

export function ImageLeft() {
  return (
    <ImageTextSplit
      heading="We show up in person"
      body={textDoc(
        "Most agencies stop at a video call. We come on site for the kickoff and the launch — it changes how the project goes.",
      )}
      image={{ mediaId: "split-onsite", alt: "" }}
      imagePosition="left"
      cta={{ label: "See where we work", href: "/about" }}
    />
  );
}

export function NoImage() {
  return (
    <ImageTextSplit
      heading="Every engagement starts the same way"
      body={textDoc(
        "A 30-minute call, a written scope, and a fixed price before any design work begins.",
        "No surprises, no hourly billing, no scope creep halfway through the build.",
      )}
      image={null}
      imagePosition="right"
      cta={null}
    />
  );
}
