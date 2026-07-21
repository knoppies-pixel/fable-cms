import { FeatureGrid } from "@fable/sections";

export function ThreeColumns() {
  return (
    <FeatureGrid
      eyebrow="Services"
      heading="Everything a marketing site needs"
      intro="From first sketch to launch day, we handle the whole build — and leave you with a site your own team can run."
      columns={3}
      items={[
        {
          title: "Brand-first design",
          description:
            "Custom layouts built around your voice and visuals, not squeezed into a template.",
        },
        {
          title: "Fast, accessible builds",
          description:
            "Static-first pages that score green on Core Web Vitals and pass WCAG AA out of the box.",
        },
        {
          title: "Editor-friendly CMS",
          description:
            "Every section is editable in plain language — no developer needed for copy changes.",
        },
        {
          title: "SEO foundations",
          description:
            "Clean metadata, structured data, and sitemaps wired in from the first deploy.",
        },
        {
          title: "Analytics that matter",
          description:
            "Privacy-friendly tracking with a dashboard your whole team actually reads.",
        },
        {
          title: "Ongoing care",
          description:
            "Monthly updates, uptime monitoring, and a real person answering the phone.",
        },
      ]}
    />
  );
}

export function TwoColumns() {
  return (
    <FeatureGrid
      eyebrow=""
      heading="Why studios pick us"
      intro=""
      columns={2}
      items={[
        {
          title: "Fixed-price projects",
          description:
            "One quote, one scope, no surprise invoices halfway through the build.",
        },
        {
          title: "Two-week launch window",
          description:
            "Most marketing sites go live within a fortnight of the kickoff call.",
        },
        {
          title: "Local support",
          description:
            "We are in your timezone and answer within a business day, usually faster.",
        },
        {
          title: "You own everything",
          description:
            "Domain, hosting, code, and content stay in accounts registered to you.",
        },
      ]}
    />
  );
}

export function FourColumnsCompact() {
  return (
    <FeatureGrid
      eyebrow="Process"
      heading="Four steps to launch"
      intro=""
      columns={4}
      items={[
        { title: "1. Discover", description: "A working session to map goals, audience, and pages." },
        { title: "2. Design", description: "Homepage concept in a week; the rest follows fast." },
        { title: "3. Build", description: "Real content in a real CMS from day one." },
        { title: "4. Launch", description: "DNS, redirects, analytics — handled and documented." },
      ]}
    />
  );
}
