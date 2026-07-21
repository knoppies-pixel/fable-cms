/**
 * Fynbos & Fern — content seed, built from kb/fynbos-fern/brief.md.
 *
 * Composition follows kb/fynbos-fern/design/DIRECTION.md (Protea Veld):
 * paper-dominant editorial pages, Olive Ink once per page (testimonials /
 * the contact band), swell reserved for entries into ink, at most two edge
 * styles per page, escape depth on one band max, ornament corners only.
 *
 * Run with: pnpm seed   (idempotent; targets SITE_SLUG=fynbos-fern)
 */
import { join } from "node:path";
import { rt, seedSite, type SiteSeedSpec } from "./seed-lib";

const BOOK_NOTE =
  "A consultation is R650, credited in full against any design fee.";

const spec: SiteSeedSpec = {
  assetsDir: join(process.cwd(), "..", "..", "kb", "fynbos-fern", "assets"),
  assets: [
    { file: "hero.jpg", alt: "Established fynbos garden above Noordhoek beach" },
    { file: "veld.jpg", alt: "Restios moving in the wind on a planted bank" },
    { file: "marli-sipho.jpg", alt: "Marli Brand and Sipho Ndlela planting out a slope" },
    { file: "gallery-noordhoek.jpg", alt: "Dune garden with proteas and silver trees, Noordhoek" },
    { file: "gallery-constantia.jpg", alt: "Former lawn converted to a waterwise meadow, Constantia" },
    { file: "gallery-kalkbay.jpg", alt: "Terraced fynbos garden on a Kalk Bay slope" },
    { file: "gallery-scarborough.jpg", alt: "Salt-wind coastal strip planting, Scarborough" },
    { file: "gallery-guesthouse.jpg", alt: "Guesthouse courtyard garden, Simon's Town" },
    { file: "gallery-hout-bay.jpg", alt: "Greywater-fed retrofit garden, Hout Bay" },
    { file: "portrait-elna.jpg", alt: "Portrait of Elna V." },
    { file: "portrait-james.jpg", alt: "Portrait of James M." },
    { file: "portrait-ayesha.jpg", alt: "Portrait of Ayesha K." },
    { file: "logo-sali.png", alt: "South African Landscapers Institute member" },
    { file: "logo-life.png", alt: "Life Landscapes nursery partner" },
    { file: "logo-kirstenbosch.png", alt: "Kirstenbosch supplier programme" },
    { file: "logo-wisa.png", alt: "Water Institute of Southern Africa" },
  ],
  pages: (img) => [
    {
      // Note: pages.title doubles as the nav label and the <title> base
      // (platform v1 — no seo.title override yet; see DECISIONS.md Phase 5).
      // Keep titles nav-short; keyword duty lives in descriptions + h1s.
      slug: "/",
      title: "Home",
      seo: {
        description:
          "Water-wise, indigenous garden design in Cape Town's southern peninsula. Fynbos & Fern designs, plants and maintains gardens that belong here. Book a consultation.",
      },
      sections: [
        {
          type: "hero",
          props: {
            heading: "We plant what",
            headingAccent: "belongs here.",
            subheading:
              "Indigenous, water-wise gardens for the southern peninsula — designed, planted and cared for by the people who know fynbos best.",
            cta: { label: "Book a garden consultation", href: "/about" },
            image: img("hero.jpg"),
            variant: "split",
            edge: "tide",
          },
        },
        {
          type: "feature_grid",
          props: {
            eyebrow: "What we do",
            heading: "From bare sand to living veld",
            intro:
              "Four services, one promise: a garden suited to this coast, this rainfall, this wind.",
            items: [
              {
                title: "Garden design",
                description:
                  "Site visit, concept plan and full planting plan, from R8 500.",
              },
              {
                title: "Installation",
                description:
                  "Our own crew builds and plants exactly what was designed — no handovers.",
              },
              {
                title: "Seasonal maintenance",
                description:
                  "Quarterly visits that prune, feed and edit the garden as it matures.",
              },
              {
                title: "Water-wise retrofits",
                description:
                  "Lawns and thirsty exotics converted to indigenous, with greywater and drip irrigation.",
              },
            ],
            columns: 2,
            background: "alt",
            ornament: true,
            edge: "swell",
          },
        },
        {
          type: "testimonials",
          props: {
            heading: "From our clients",
            items: [
              {
                quote:
                  "Two winters in and we haven't watered once. The garden looks more alive every month.",
                author: "Elna V.",
                role: "Homeowner, Constantia",
                image: img("portrait-elna.jpg"),
              },
              {
                quote:
                  "Guests photograph the courtyard as much as the mountain. Marli's planting did that.",
                author: "James M.",
                role: "Guesthouse owner, Simon's Town",
                image: img("portrait-james.jpg"),
              },
              {
                quote:
                  "They arrived with a plan drawn for our actual slope and wind, not a catalogue garden.",
                author: "Ayesha K.",
                role: "Homeowner, Kalk Bay",
                image: img("portrait-ayesha.jpg"),
              },
            ],
            background: "ink",
          },
        },
        {
          type: "image_text_split",
          props: {
            heading: "Why indigenous?",
            body: rt.doc(
              rt.p(
                "A fynbos garden isn't a compromise — it's the only garden that gets better through a Cape summer. Deep-rooted, wind-shaped, alive with sunbirds within a season.",
              ),
              rt.p(
                "We grew up with this flora: Marli spent twelve years at Kirstenbosch before founding the studio. Every plant list starts with what your soil and slope already want to grow.",
              ),
            ),
            image: img("veld.jpg"),
            imagePosition: "right",
            depth: "escape",
          },
        },
        {
          type: "cta_banner",
          props: {
            heading: "Start with a walk",
            headingAccent: "through your garden.",
            body: `${BOOK_NOTE} We come to you, anywhere from Noordhoek to Constantia.`,
            cta: { label: "Book a garden consultation", href: "/about" },
            variant: "accent",
            ornament: true,
          },
        },
      ],
    },
    {
      slug: "/portfolio",
      title: "Portfolio",
      seo: {
        description:
          "Recent indigenous and water-wise gardens by Fynbos & Fern: Noordhoek, Constantia, Kalk Bay, Scarborough, Simon's Town and Hout Bay.",
      },
      sections: [
        {
          type: "rich_text",
          props: {
            body: rt.doc(
              rt.h(1, "Gardens that belong to this coast"),
              rt.p(
                "Six recent projects across the peninsula. Every one is indigenous, water-wise, and designed for its own soil, slope and wind — no catalogue planting, no two alike.",
              ),
            ),
            width: "narrow",
          },
        },
        {
          type: "gallery",
          props: {
            images: [
              img("gallery-noordhoek.jpg"),
              img("gallery-constantia.jpg"),
              img("gallery-kalkbay.jpg"),
              img("gallery-scarborough.jpg"),
              img("gallery-guesthouse.jpg"),
              img("gallery-hout-bay.jpg"),
            ],
            columns: 3,
            edge: "swell",
          },
        },
        {
          type: "testimonials",
          props: {
            heading: "",
            items: [
              {
                quote:
                  "We asked for a garden that could survive the water restrictions. We got one the whole street stops to look at.",
                author: "Elna V.",
                role: "Constantia lawn conversion, 2025",
                image: img("portrait-elna.jpg"),
              },
            ],
            background: "ink",
          },
        },
        {
          type: "cta_banner",
          props: {
            heading: "Your garden could be next.",
            body: BOOK_NOTE,
            cta: { label: "Book a garden consultation", href: "/about" },
            variant: "subtle",
          },
        },
      ],
    },
    {
      slug: "/about",
      title: "About",
      seo: {
        description:
          "Founded by ex-Kirstenbosch horticulturist Marli Brand and project manager Sipho Ndlela. SALI-member studio for waterwise landscaping in Cape Town's southern suburbs.",
      },
      sections: [
        {
          type: "rich_text",
          props: {
            body: rt.doc(
              rt.h(1, "Rooted in the peninsula"),
              rt.p(
                "Fynbos & Fern is a two-person studio in Noordhoek: Marli Brand, garden designer and horticulturist with twelve years at Kirstenbosch, and Sipho Ndlela, who runs every project from first dig to final walkthrough.",
              ),
              rt.p(
                "We only build gardens from indigenous Cape flora — fynbos, restios, buchus, silver trees — because on this coast they outgrow, outlast and outshine anything imported.",
              ),
              rt.h(2, "How a project runs"),
              rt.bullets(
                "Consultation walk — R650, credited against any design fee",
                "Concept + planting plan, drawn for your soil, slope and wind",
                "Installation by our own crew, never subcontracted",
                "Optional quarterly maintenance while the garden establishes",
              ),
            ),
            width: "narrow",
          },
        },
        {
          type: "image_text_split",
          props: {
            heading: "The two of us,",
            headingAccent: "on every site.",
            body: rt.doc(
              rt.p(
                "No account managers, no rotating crews. The people you meet on the consultation walk are the people kneeling in your beds on planting day.",
              ),
            ),
            image: img("marli-sipho.jpg"),
            imagePosition: "left",
            depth: "escape",
          },
        },
        {
          type: "faq_accordion",
          props: {
            heading: "Questions we're always asked",
            items: [
              {
                question: "What does a garden cost?",
                answer:
                  "Design starts at R8 500 for a typical suburban plot. Installation depends on size and terrain — the concept plan comes with a fixed installation quote, so there are no surprises.",
              },
              {
                question: "Will it survive water restrictions?",
                answer:
                  "That's the point of planting indigenous. Established fynbos gardens need little to no irrigation; our retrofits add greywater and drip systems for the first two summers of establishment.",
              },
              {
                question: "Do you maintain gardens you didn't build?",
                answer:
                  "Yes, if the planting is indigenous or you want it converted. The first maintenance visit doubles as an assessment.",
              },
              {
                question: "Which areas do you cover?",
                answer:
                  "The southern peninsula — Noordhoek to Constantia — as standard. Larger projects further afield by arrangement.",
              },
            ],
          },
        },
        {
          type: "logo_strip",
          props: {
            heading: "Accredited & partnered",
            logos: [
              img("logo-sali.png"),
              img("logo-life.png"),
              img("logo-kirstenbosch.png"),
              img("logo-wisa.png"),
            ],
            edge: "swell",
          },
        },
        {
          type: "contact_form",
          props: {
            heading: "Book a consultation",
            intro: `Tell us about your plot — size, slope, what grows there now. ${BOOK_NOTE}`,
            showPhone: true,
            submitLabel: "Send enquiry",
            successMessage:
              "Thank you — we'll reply within one working day to set up the walk.",
            background: "ink",
          },
        },
        {
          type: "cta_banner",
          props: {
            heading: "Rather talk it through?",
            body: "Weekdays 08:00–17:00 you'll reach Sipho directly. Or find us on Instagram @fynbosandfern.",
            cta: { label: "021 555 0184", href: "tel:+27215550184" },
            variant: "subtle",
          },
        },
      ],
    },
  ],
};

seedSite(spec).catch((error) => {
  console.error(error);
  process.exit(1);
});
