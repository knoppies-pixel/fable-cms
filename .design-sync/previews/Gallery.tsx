import { Gallery, registerMedia } from "@fable/sections";

const svg = (w: number, h: number, from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/>` +
      `</linearGradient></defs><rect width='${w}' height='${h}' fill='url(#g)'/></svg>`,
  )}`;

registerMedia([
  { id: "gal-1", url: svg(800, 600, "#0e7490", "#0f2e35"), alt: "Storefront exterior", width: 800, height: 600 },
  { id: "gal-2", url: svg(800, 600, "#164e63", "#48606b"), alt: "Barista pouring latte art", width: 800, height: 600 },
  { id: "gal-3", url: svg(800, 600, "#06b6d4", "#164e63"), alt: "Fresh pastries on the counter", width: 800, height: 600 },
  { id: "gal-4", url: svg(800, 600, "#48606b", "#0e7490"), alt: "Window seating at golden hour", width: 800, height: 600 },
  { id: "gal-5", url: svg(800, 600, "#0f2e35", "#06b6d4"), alt: "Roastery equipment", width: 800, height: 600 },
  { id: "gal-6", url: svg(800, 600, "#164e63", "#0e7490"), alt: "Weekend market stall", width: 800, height: 600 },
  { id: "gal-7", url: svg(800, 600, "#0e7490", "#48606b"), alt: "Staff team portrait", width: 800, height: 600 },
  { id: "gal-8", url: svg(800, 600, "#06b6d4", "#0f2e35"), alt: "Signature flat white", width: 800, height: 600 },
]);

export function ThreeColumns() {
  return (
    <Gallery
      heading="Inside the café"
      columns={3}
      images={[
        { mediaId: "gal-1", alt: "Storefront exterior" },
        { mediaId: "gal-2", alt: "Barista pouring latte art" },
        { mediaId: "gal-3", alt: "Fresh pastries on the counter" },
        { mediaId: "gal-4", alt: "Window seating at golden hour" },
        { mediaId: "gal-5", alt: "Roastery equipment" },
        { mediaId: "gal-6", alt: "Weekend market stall" },
      ]}
    />
  );
}

export function TwoColumnsNoHeading() {
  return (
    <Gallery
      heading=""
      columns={2}
      images={[
        { mediaId: "gal-7", alt: "Staff team portrait" },
        { mediaId: "gal-8", alt: "Signature flat white" },
        { mediaId: "gal-1", alt: "Storefront exterior" },
        { mediaId: "gal-4", alt: "Window seating at golden hour" },
      ]}
    />
  );
}
