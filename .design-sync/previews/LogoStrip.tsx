import { LogoStrip, registerMedia } from "@fable/sections";

const svg = (w: number, h: number, from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/>` +
      `</linearGradient></defs><rect width='${w}' height='${h}' fill='url(#g)'/></svg>`,
  )}`;

registerMedia([
  { id: "logo-fern", url: svg(160, 48, "#0e7490", "#164e63"), alt: "Fern Café", width: 160, height: 48 },
  { id: "logo-botha", url: svg(160, 48, "#164e63", "#0f2e35"), alt: "Botha Electrical", width: 160, height: 48 },
  { id: "logo-corvid", url: svg(160, 48, "#06b6d4", "#0e7490"), alt: "Corvid Legal", width: 160, height: 48 },
  { id: "logo-harbourline", url: svg(160, 48, "#48606b", "#164e63"), alt: "Harbourline Logistics", width: 160, height: 48 },
  { id: "logo-meridian", url: svg(160, 48, "#0f2e35", "#48606b"), alt: "Meridian Physio", width: 160, height: 48 },
]);

const logos = [
  { mediaId: "logo-fern", alt: "Fern Café" },
  { mediaId: "logo-botha", alt: "Botha Electrical" },
  { mediaId: "logo-corvid", alt: "Corvid Legal" },
  { mediaId: "logo-harbourline", alt: "Harbourline Logistics" },
  { mediaId: "logo-meridian", alt: "Meridian Physio" },
];

export function GrayscaleWithHeading() {
  return <LogoStrip heading="Trusted by local businesses" logos={logos} grayscale={true} />;
}

export function FullColorNoHeading() {
  return <LogoStrip heading="" logos={logos} grayscale={false} />;
}
