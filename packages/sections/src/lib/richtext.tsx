import type { ReactNode } from "react";
import { z } from "zod";

/**
 * Rich text is stored as Tiptap JSON (spec §3) and rendered server-side.
 * This renderer covers the v1 node set: paragraph, heading, bullet/ordered
 * lists, blockquote, hardBreak, and text with bold/italic/link marks.
 * Unknown node types render their children (or nothing) instead of failing —
 * editor upgrades must never break a published page.
 */

export interface RichTextNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: RichTextNode[];
}

const richTextNode: z.ZodType<RichTextNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    text: z.string().optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    marks: z
      .array(
        z.object({
          type: z.string(),
          attrs: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .optional(),
    content: z.array(richTextNode).optional(),
  }),
);

export const richTextDoc = z.object({
  type: z.literal("doc"),
  content: z.array(richTextNode).default([]),
});
export type RichTextDoc = z.infer<typeof richTextDoc>;

/** Convenience for seeds/defaults: a doc with one paragraph per string. */
export function textDoc(...paragraphs: string[]): RichTextDoc {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

function renderText(node: RichTextNode, key: number): ReactNode {
  let rendered: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        rendered = <strong>{rendered}</strong>;
        break;
      case "italic":
        rendered = <em>{rendered}</em>;
        break;
      case "link": {
        const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "#";
        rendered = (
          <a href={href} className="font-medium text-accent underline underline-offset-2">
            {rendered}
          </a>
        );
        break;
      }
      default:
        break;
    }
  }
  return <span key={key}>{rendered}</span>;
}

function renderChildren(node: RichTextNode): ReactNode {
  return (node.content ?? []).map((child, i) => renderNode(child, i));
}

const headingClasses: Record<number, string> = {
  1: "font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl",
  2: "font-display text-3xl font-semibold tracking-tight",
  3: "font-display text-xl font-semibold",
  4: "text-lg font-semibold",
};

function renderNode(node: RichTextNode, key: number): ReactNode {
  switch (node.type) {
    case "text":
      return renderText(node, key);
    case "paragraph":
      return (
        <p key={key} className="leading-relaxed">
          {renderChildren(node)}
        </p>
      );
    case "heading": {
      const level =
        typeof node.attrs?.level === "number" &&
        node.attrs.level >= 1 &&
        node.attrs.level <= 4
          ? node.attrs.level
          : 2;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
      return (
        <Tag key={key} className={headingClasses[level]}>
          {renderChildren(node)}
        </Tag>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className="list-disc space-y-1 pl-6">
          {renderChildren(node)}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="list-decimal space-y-1 pl-6">
          {renderChildren(node)}
        </ol>
      );
    case "listItem":
      return <li key={key}>{renderChildren(node)}</li>;
    case "blockquote":
      return (
        <blockquote key={key} className="border-l-4 border-accent pl-5 font-display text-xl italic leading-snug sm:text-2xl">
          {renderChildren(node)}
        </blockquote>
      );
    case "hardBreak":
      return <br key={key} />;
    default:
      return <span key={key}>{renderChildren(node)}</span>;
  }
}

export function RichText({
  doc,
  className,
}: {
  doc: RichTextDoc;
  className?: string;
}) {
  return (
    <div className={className ?? "space-y-4"}>
      {doc.content.map((node, i) => renderNode(node, i))}
    </div>
  );
}
