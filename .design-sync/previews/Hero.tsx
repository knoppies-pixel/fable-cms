import { Hero, registerMedia } from "@fable/sections";

const svg = (w: number, h: number, from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/>` +
      `</linearGradient></defs><rect width='${w}' height='${h}' fill='url(#g)'/></svg>`,
  )}`;

registerMedia([
  { id: "hero-split", url: svg(1200, 900, "#0e7490", "#0f2e35"), alt: "Studio at work", width: 1200, height: 900 },
  { id: "hero-bleed", url: svg(1920, 1080, "#164e63", "#0f2e35"), alt: "Coastal landscape", width: 1920, height: 1080 },
]);

export function Centered() {
  return (
    <Hero
      heading="Design that ships"
      subheading="A small studio building fast, accessible marketing sites for growing businesses."
      cta={{ label: "Start a project", href: "/contact" }}
      image={null}
      variant="centered"
    />
  );
}

export function Split() {
  return (
    <Hero
      heading="Your site, live in weeks"
      subheading="Strategy, design, and build under one roof — no hand-offs, no surprises."
      cta={{ label: "See our process", href: "/process" }}
      image={{ mediaId: "hero-split", alt: "" }}
      variant="split"
    />
  );
}

export function FullBleed() {
  return (
    <Hero
      heading="Built for the long haul"
      subheading="Sites your team can run without us — that's the point."
      cta={{ label: "Talk to us", href: "/contact" }}
      image={{ mediaId: "hero-bleed", alt: "" }}
      variant="full-bleed"
    />
  );
}
