import { FaqAccordion } from "@fable/sections";

export function Standard() {
  return (
    <FaqAccordion
      heading="Frequently asked questions"
      items={[
        {
          question: "How long does a typical project take?",
          answer:
            "Most marketing sites launch within two to three weeks of the kickoff call, depending on how much content is ready to go.",
        },
        {
          question: "Do you work with our existing brand guidelines?",
          answer:
            "Yes. Send us your brand system and we design within it — no ground-up rebrand unless you ask for one.",
        },
        {
          question: "Can our team make edits after launch?",
          answer:
            "Every site ships on a CMS built for non-developers. Text, images, and sections can be edited without touching code.",
        },
        {
          question: "What happens if we need support later?",
          answer:
            "We offer a monthly care plan covering updates, monitoring, and small content requests, or you can go fully self-serve.",
        },
      ]}
    />
  );
}

export function LongAnswers() {
  return (
    <FaqAccordion
      heading="Pricing and process"
      items={[
        {
          question: "How is a project priced?",
          answer:
            "We quote a fixed price after the discovery call, based on the number of page types and the complexity of the CMS.\n\nThere are no hourly surprises — if the scope changes, we requote before doing extra work, not after.",
        },
        {
          question: "What do you need from us to get started?",
          answer:
            "A brand kit if you have one, access to your domain registrar, and a point of contact who can approve copy and design.\n\nWe handle everything else, including hosting setup and DNS.",
        },
        {
          question: "Do you offer a payment plan?",
          answer:
            "Standard terms are 50% at kickoff and 50% at launch. For larger projects we can split into three milestones instead.",
        },
      ]}
    />
  );
}

export function SingleQuestion() {
  return (
    <FaqAccordion
      heading="One thing people ask"
      items={[
        {
          question: "Is hosting included in the project price?",
          answer:
            "No — hosting is billed separately at cost, usually a few dollars a month, and stays in an account registered to you.",
        },
      ]}
    />
  );
}
