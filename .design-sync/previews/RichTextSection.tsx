import { RichTextSection, textDoc } from "@fable/sections";
import type { RichTextDoc } from "@fable/sections";

const article: RichTextDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "How we scope a project" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Every engagement starts with a working session, not a " },
        { type: "text", text: "questionnaire", marks: [{ type: "italic" }] },
        { type: "text", text: ". We want to hear the problem before we talk about pages." },
      ],
    },
    { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "What's included" }] },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Content strategy and page map" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Custom design in your brand system" }] }] },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "A CMS your team can edit — see our " },
                { type: "text", text: "editor guide", marks: [{ type: "link", attrs: { href: "/guide" } }] },
                { type: "text", text: " for a walkthrough" },
              ],
            },
          ],
        },
      ],
    },
    { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Typical timeline" }] },
    {
      type: "orderedList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Week 1 — discovery and content plan" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Week 2 — design and review" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Week 3 — build and launch" }] }] },
      ],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "They shipped in two weeks and our team has made every edit since without calling support.", marks: [{ type: "bold" }] }],
        },
      ],
    },
  ],
};

export function NarrowArticle() {
  return <RichTextSection body={article} width="narrow" />;
}

export function NormalWidth() {
  return <RichTextSection body={article} width="normal" />;
}

export function SimpleParagraphs() {
  return (
    <RichTextSection
      body={textDoc(
        "We are a small studio building marketing sites for growing businesses.",
        "If you need a partner who can own design, content, and the build end to end, get in touch.",
      )}
      width="narrow"
    />
  );
}
